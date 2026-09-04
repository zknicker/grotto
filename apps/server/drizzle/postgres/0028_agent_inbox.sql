-- The transcript is human conversation only, and the agent-only lane has its
-- real name. Three changes ride together because they are one decision:
--
--   1. `system_author` goes. The last kind, `session`, stops being a message:
--      an Agent message now carries the `session_generation` that wrote it and
--      the App derives the session mark from a change in that value.
--   2. `agent_pending_work` becomes `agent_inbox`. The rows are inbox items —
--      Chat deliveries, action attentions, task assignments, and automation
--      fires — so their ids take the `inb_` prefix with the table.
--   3. `message_causes` records how the Server learned a cause: the Agent's own
--      `--cause` (`explicit`) or a sole served fire answered in its anchor Chat
--      (`inferred`). Every existing row came from `--cause`.

-- Links into `chat_messages` are DEFERRABLE INITIALLY DEFERRED, so the delete
-- below would queue constraint-trigger events until commit, and PostgreSQL
-- refuses to ALTER a table that has pending trigger events -- which rebuilding
-- the author CHECK must do. Checking each link at its own statement drains the
-- queue as the migration goes.
SET CONSTRAINTS ALL IMMEDIATE;--> statement-breakpoint

DELETE FROM "chat_messages" WHERE "system_author" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_author_shape";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN "system_author";--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "session_generation" integer;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_shape" CHECK ((
                ("chat_messages"."author_user_id" is not null and "chat_messages"."author_agent_id" is null)
                or
                ("chat_messages"."author_agent_id" is not null and "chat_messages"."author_user_id" is null)
            ));--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_generation" CHECK ("chat_messages"."session_generation" is null or (
                "chat_messages"."session_generation" > 0 and "chat_messages"."author_agent_id" is not null
            ));--> statement-breakpoint

ALTER TABLE "message_causes" ADD COLUMN "attribution" text DEFAULT 'explicit' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_causes" ALTER COLUMN "attribution" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "message_causes" ADD CONSTRAINT "message_causes_attribution" CHECK ("message_causes"."attribution" in ('explicit', 'inferred'));--> statement-breakpoint

ALTER TABLE "agent_pending_work" RENAME TO "agent_inbox";--> statement-breakpoint
ALTER TABLE "agent_inbox" RENAME CONSTRAINT "agent_pending_work_pkey" TO "agent_inbox_pkey";--> statement-breakpoint
ALTER TABLE "agent_inbox" RENAME CONSTRAINT "agent_pending_work_server_id_servers_id_fk" TO "agent_inbox_server_id_servers_id_fk";--> statement-breakpoint
ALTER TABLE "agent_inbox" RENAME CONSTRAINT "agent_pending_work_agent_fk" TO "agent_inbox_agent_fk";--> statement-breakpoint
ALTER TABLE "agent_inbox" RENAME CONSTRAINT "agent_pending_work_chat_fk" TO "agent_inbox_chat_fk";--> statement-breakpoint
ALTER TABLE "agent_inbox" RENAME CONSTRAINT "agent_pending_work_state" TO "agent_inbox_state";--> statement-breakpoint
ALTER INDEX "agent_pending_work_dedupe_key" RENAME TO "agent_inbox_dedupe_key";--> statement-breakpoint
ALTER INDEX "agent_pending_work_queue_idx" RENAME TO "agent_inbox_queue_idx";--> statement-breakpoint
ALTER INDEX "agent_pending_work_queued_idx" RENAME TO "agent_inbox_queued_idx";--> statement-breakpoint
ALTER INDEX "agent_pending_work_run_idx" RENAME TO "agent_inbox_run_idx";--> statement-breakpoint

ALTER TABLE "agent_inbox" DROP CONSTRAINT "agent_pending_work_id_shape";--> statement-breakpoint
UPDATE "agent_inbox" SET "id" = 'inb_' || substring("id" from 5) WHERE "id" LIKE 'apw!_%' ESCAPE '!';--> statement-breakpoint
ALTER TABLE "agent_inbox" ADD CONSTRAINT "agent_inbox_id_shape" CHECK ("agent_inbox"."id" ~ '^inb_[A-Za-z0-9_-]{16}$');--> statement-breakpoint

CREATE TABLE "agent_session_rotations" (
	"agent_id" text NOT NULL,
	"generation" integer NOT NULL,
	"previous_started_at" timestamp with time zone,
	"reason" text NOT NULL,
	"rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_id" text NOT NULL,
	CONSTRAINT "agent_session_rotations_server_id_agent_id_generation_pk" PRIMARY KEY("server_id","agent_id","generation"),
	CONSTRAINT "agent_session_rotations_generation" CHECK ("agent_session_rotations"."generation" > 1),
	CONSTRAINT "agent_session_rotations_reason" CHECK ("agent_session_rotations"."reason" in ('configuration', 'full', 'recovery', 'session'))
);--> statement-breakpoint
ALTER TABLE "agent_session_rotations" ADD CONSTRAINT "agent_session_rotations_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;
