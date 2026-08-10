CREATE TABLE "agent_channel_mutes" (
	"agent_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"chat_kind" text DEFAULT 'channel' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_id" text NOT NULL,
	CONSTRAINT "agent_channel_mutes_server_id_agent_id_chat_id_pk" PRIMARY KEY("server_id","agent_id","chat_id"),
	CONSTRAINT "agent_channel_mutes_kind" CHECK ("agent_channel_mutes"."chat_kind" = 'channel')
);
--> statement-breakpoint
CREATE TABLE "agent_thread_follows" (
	"agent_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"followed" boolean DEFAULT true NOT NULL,
	"server_id" text NOT NULL,
	"thread_chat_id" text NOT NULL,
	"thread_chat_kind" text DEFAULT 'thread' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_thread_follows_server_id_agent_id_thread_chat_id_pk" PRIMARY KEY("server_id","agent_id","thread_chat_id"),
	CONSTRAINT "agent_thread_follows_kind" CHECK ("agent_thread_follows"."thread_chat_kind" = 'thread')
);
--> statement-breakpoint
CREATE TABLE "agent_delivery" (
	"accepted_at" timestamp with time zone,
	"active_run_chat_id" text,
	"active_run_computer_id" text,
	"active_run_id" text,
	"active_run_model_id" text,
	"active_run_runtime_id" text,
	"agent_chain_turns" integer DEFAULT 0 NOT NULL,
	"agent_id" text PRIMARY KEY NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"dispatched_at" timestamp with time zone,
	"retry_after" timestamp with time zone,
	"server_id" text NOT NULL,
	"stopped" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_delivery_nonnegative_chain_turns" CHECK ("agent_delivery"."agent_chain_turns" >= 0),
	CONSTRAINT "agent_delivery_nonnegative_failures" CHECK ("agent_delivery"."consecutive_failures" >= 0),
	CONSTRAINT "agent_delivery_active_run" CHECK ((
                "agent_delivery"."active_run_id" is null
                and "agent_delivery"."active_run_chat_id" is null
                and "agent_delivery"."active_run_computer_id" is null
                and "agent_delivery"."active_run_runtime_id" is null
                and "agent_delivery"."active_run_model_id" is null
                and "agent_delivery"."accepted_at" is null
                and "agent_delivery"."dispatched_at" is null
            ) or (
                "agent_delivery"."active_run_id" is not null
                and "agent_delivery"."active_run_chat_id" is not null
                and "agent_delivery"."active_run_computer_id" is not null
                and "agent_delivery"."active_run_runtime_id" is not null
                and "agent_delivery"."active_run_model_id" is not null
            ))
);
--> statement-breakpoint
CREATE TABLE "agent_pending_work" (
	"agent_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"pierced" boolean DEFAULT false NOT NULL,
	"run_id" text,
	"server_id" text NOT NULL,
	"source" text DEFAULT 'human' NOT NULL,
	CONSTRAINT "agent_pending_work_id_shape" CHECK ("agent_pending_work"."id" ~ '^apw_[A-Za-z0-9_-]{16}$')
);
--> statement-breakpoint
CREATE TABLE "agent_inbox_cursors" (
	"agent_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"delivered_up_to_sequence" integer DEFAULT 0 NOT NULL,
	"seen_up_to_sequence" integer DEFAULT 0 NOT NULL,
	"served_up_to_sequence" integer DEFAULT 0 NOT NULL,
	"server_id" text NOT NULL,
	"session_generation" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_inbox_cursors_server_id_agent_id_session_generation_chat_id_pk" PRIMARY KEY("server_id","agent_id","session_generation","chat_id"),
	CONSTRAINT "agent_inbox_cursors_nonnegative" CHECK ("agent_inbox_cursors"."delivered_up_to_sequence" >= 0
                and "agent_inbox_cursors"."seen_up_to_sequence" >= 0
                and "agent_inbox_cursors"."served_up_to_sequence" >= 0
                and "agent_inbox_cursors"."session_generation" > 0)
);
--> statement-breakpoint
CREATE TABLE "agent_inbox_pierces" (
	"agent_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_id" text NOT NULL,
	"seen_at" timestamp with time zone,
	"server_id" text NOT NULL,
	"served_at" timestamp with time zone,
	"session_generation" integer NOT NULL,
	CONSTRAINT "agent_inbox_pierces_server_id_agent_id_session_generation_chat_id_message_id_pk" PRIMARY KEY("server_id","agent_id","session_generation","chat_id","message_id"),
	CONSTRAINT "agent_inbox_pierces_generation" CHECK ("agent_inbox_pierces"."session_generation" > 0)
);
--> statement-breakpoint
CREATE TABLE "agent_message_drafts" (
	"agent_id" text NOT NULL,
	"attachment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chat_id" text NOT NULL,
	"content" text NOT NULL,
	"rehold_count" integer NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_id" text NOT NULL,
	"session_generation" integer NOT NULL,
	CONSTRAINT "agent_message_drafts_server_id_agent_id_session_generation_chat_id_pk" PRIMARY KEY("server_id","agent_id","session_generation","chat_id"),
	CONSTRAINT "agent_message_drafts_shape" CHECK ("agent_message_drafts"."rehold_count" > 0 and "agent_message_drafts"."session_generation" > 0)
);
--> statement-breakpoint
CREATE TABLE "manual_lookup_audit" (
	"agent_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"intent" text NOT NULL,
	"operation" text NOT NULL,
	"query" text,
	"reason" text NOT NULL,
	"run_id" text,
	"runner_id" text NOT NULL,
	"server_id" text NOT NULL,
	"topic_id" text,
	CONSTRAINT "manual_lookup_audit_id_shape" CHECK ("manual_lookup_audit"."id" ~ '^aml_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "manual_lookup_audit_intent_length" CHECK (char_length("manual_lookup_audit"."intent") between 12 and 500),
	CONSTRAINT "manual_lookup_audit_reason_length" CHECK (char_length("manual_lookup_audit"."reason") between 12 and 500),
	CONSTRAINT "manual_lookup_audit_operation" CHECK ("manual_lookup_audit"."operation" IN ('get', 'search')),
	CONSTRAINT "manual_lookup_audit_target_shape" CHECK (("manual_lookup_audit"."operation" = 'get' AND "manual_lookup_audit"."topic_id" IS NOT NULL AND "manual_lookup_audit"."query" IS NULL) OR ("manual_lookup_audit"."operation" = 'search' AND "manual_lookup_audit"."topic_id" IS NULL AND "manual_lookup_audit"."query" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "agent_runner_credentials" (
	"agent_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"capabilities" text[] DEFAULT ARRAY['manual']::text[] NOT NULL,
	"computer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '12 hours' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"revoked_at" timestamp with time zone,
	"run_id" text NOT NULL,
	"server_id" text NOT NULL,
	"token_hash" text NOT NULL,
	CONSTRAINT "agent_runner_credentials_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "agent_runner_credentials_id_shape" CHECK ("agent_runner_credentials"."id" ~ '^arc_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "agent_runner_credentials_token_hash_shape" CHECK ("agent_runner_credentials"."token_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "agent_turns" (
	"agent_id" text NOT NULL,
	"computer_id" text NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" text NOT NULL,
	"server_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	CONSTRAINT "agent_turns_status" CHECK ("agent_turns"."status" in ('completed', 'failed')),
	CONSTRAINT "agent_turns_message_count" CHECK ("agent_turns"."message_count" >= 0),
	CONSTRAINT "agent_turns_id_shape" CHECK ("agent_turns"."id" ~ '^atn_[A-Za-z0-9_-]{16}$')
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"avatar_id" text,
	"computer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"desired_model_id" text,
	"desired_runtime_id" text,
	"description" text,
	"display_name" text NOT NULL,
	"effective_missing" jsonb,
	"effective_model_id" text,
	"effective_reported_at" timestamp with time zone,
	"effective_runtime_id" text,
	"factory_applied_at" timestamp with time zone,
	"factory_kind" text DEFAULT 'ordinary' NOT NULL,
	"handle" text NOT NULL,
	"home_timezone" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"retired_at" timestamp with time zone,
	"role" text NOT NULL,
	"session_generation" integer DEFAULT 1 NOT NULL,
	"session_reset_kind" text DEFAULT 'session' NOT NULL,
	"server_id" text NOT NULL,
	CONSTRAINT "agents_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "agents_role" CHECK ("agents"."role" in ('admin', 'member')),
	CONSTRAINT "agents_factory_kind" CHECK ("agents"."factory_kind" in ('ordinary', 'cove')),
	CONSTRAINT "agents_positive_session_generation" CHECK ("agents"."session_generation" > 0),
	CONSTRAINT "agents_session_reset_kind" CHECK ("agents"."session_reset_kind" in ('full', 'session')),
	CONSTRAINT "agents_description_length" CHECK ("agents"."description" is null or char_length("agents"."description") between 1 and 500),
	CONSTRAINT "agents_configuration" CHECK ((
                ("agents"."computer_id" is null and "agents"."desired_runtime_id" is null and "agents"."desired_model_id" is null)
                or ("agents"."computer_id" is not null and "agents"."desired_runtime_id" is not null and "agents"."desired_model_id" is not null)
            ))
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"attempt_id" text,
	"byte_size" bigint,
	"chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_at" timestamp with time zone,
	"failure_code" text,
	"filename" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"media_type" text NOT NULL,
	"message_id" text,
	"message_position" integer,
	"ready_at" timestamp with time zone,
	"server_id" text NOT NULL,
	"sha256" text,
	"staging_key" text,
	"state" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"upload_nonce" text NOT NULL,
	"uploader_agent_id" text,
	"uploader_user_id" text,
	CONSTRAINT "attachments_id_shape" CHECK ("attachments"."id" ~ '^att_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "attachments_state" CHECK ("attachments"."state" in ('pending', 'uploading', 'finalizing', 'ready', 'failed')),
	CONSTRAINT "attachments_size" CHECK ("attachments"."byte_size" is null or ("attachments"."byte_size" >= 0 and "attachments"."byte_size" <= 52428800)),
	CONSTRAINT "attachments_sha256" CHECK ("attachments"."sha256" is null or "attachments"."sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "attachments_message_ready" CHECK ("attachments"."message_id" is null or (
                "attachments"."chat_id" is not null and "attachments"."state" = 'ready'
                and "attachments"."message_position" is not null
                and "attachments"."message_position" >= 0
            )),
	CONSTRAINT "attachments_uploader_shape" CHECK (num_nonnulls("attachments"."uploader_user_id", "attachments"."uploader_agent_id") = 1),
	CONSTRAINT "attachments_failure_shape" CHECK (("attachments"."state" = 'failed') = ("attachments"."failure_code" is not null))
);
--> statement-breakpoint
CREATE TABLE "avatars" (
	"byte_size" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"media_type" text NOT NULL,
	"sha256" text NOT NULL,
	CONSTRAINT "avatars_id_shape" CHECK ("avatars"."id" ~ '^avt_[a-z0-9]{16}$'),
	CONSTRAINT "avatars_media_type" CHECK ("avatars"."media_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "avatars_size" CHECK ("avatars"."byte_size" > 0 and "avatars"."byte_size" <= 2097152),
	CONSTRAINT "avatars_sha256" CHECK ("avatars"."sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "chat_events" (
	"chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cursor" bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"label_id" text,
	"message_id" text,
	"reader_user_id" text,
	"reminder_action" text,
	"reminder_id" text,
	"sequence" integer NOT NULL,
	"server_id" text NOT NULL,
	"event_type" text NOT NULL,
	CONSTRAINT "chat_events_positive_cursor" CHECK ("chat_events"."cursor" > 0),
	CONSTRAINT "chat_events_shape" CHECK ((
                ("chat_events"."event_type" = 'message.created'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."sequence" > 0)
                OR
                ("chat_events"."event_type" IN ('task.created', 'task.updated')
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."sequence" > 0)
                OR
                ("chat_events"."event_type" = 'chat.read'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NOT NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."sequence" >= 0)
                OR
                ("chat_events"."event_type" = 'thread.follow.updated'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NOT NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."sequence" >= 0)
                OR
                ("chat_events"."event_type" = 'reminder.changed'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NOT NULL
                    AND "chat_events"."reminder_action" IN (
                        'scheduled', 'updated', 'snoozed', 'canceled', 'fired'
                    )
                    AND "chat_events"."sequence" >= 0)
                OR
                ("chat_events"."event_type" = 'task.label.updated'
                    AND "chat_events"."chat_id" IS NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NOT NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."sequence" = 0)
            ))
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"author_agent_id" text,
	"author_user_id" text,
	"chat_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"nonce" text NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
	"sequence" integer NOT NULL,
	"server_id" text NOT NULL,
	"system_author" text,
	CONSTRAINT "chat_messages_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "chat_messages_chat_id_key" UNIQUE("server_id","chat_id","id"),
	CONSTRAINT "chat_messages_positive_sequence" CHECK ("chat_messages"."sequence" > 0),
	CONSTRAINT "chat_messages_author_shape" CHECK ((
                ("chat_messages"."author_user_id" is not null and "chat_messages"."author_agent_id" is null and "chat_messages"."system_author" is null)
                or
                ("chat_messages"."author_agent_id" is not null and "chat_messages"."author_user_id" is null and "chat_messages"."system_author" is null)
                or
                ("chat_messages"."author_user_id" is null and "chat_messages"."author_agent_id" is null and "chat_messages"."system_author" in ('reminder', 'session', 'task'))
            ))
);
--> statement-breakpoint
CREATE TABLE "chat_reads" (
	"chat_id" text NOT NULL,
	"reader_user_id" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"server_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_reads_server_id_chat_id_reader_user_id_pk" PRIMARY KEY("server_id","chat_id","reader_user_id")
);
--> statement-breakpoint
CREATE TABLE "channel_agent_participants" (
	"agent_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"chat_kind" text DEFAULT 'channel' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_id" text NOT NULL,
	CONSTRAINT "channel_agent_participants_server_id_chat_id_agent_id_pk" PRIMARY KEY("server_id","chat_id","agent_id"),
	CONSTRAINT "channel_agent_participants_kind" CHECK ("channel_agent_participants"."chat_kind" = 'channel')
);
--> statement-breakpoint
CREATE TABLE "channel_participants" (
	"chat_id" text NOT NULL,
	"chat_kind" text DEFAULT 'channel' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "channel_participants_server_id_chat_id_user_id_pk" PRIMARY KEY("server_id","chat_id","user_id"),
	CONSTRAINT "channel_participants_kind" CHECK ("channel_participants"."chat_kind" = 'channel')
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dm_agent_id" text,
	"dm_member_one_stint" integer,
	"dm_member_one_user_id" text,
	"dm_member_two_stint" integer,
	"dm_member_two_user_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_all" boolean DEFAULT false NOT NULL,
	"kind" text NOT NULL,
	"last_activity_at" timestamp with time zone,
	"last_message_sequence" integer DEFAULT 0 NOT NULL,
	"last_task_number" integer DEFAULT 0 NOT NULL,
	"name" text,
	"anchor_message_id" text,
	"parent_chat_id" text,
	"parent_chat_kind" text,
	"server_id" text NOT NULL,
	CONSTRAINT "chats_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "chats_server_id_kind_key" UNIQUE("server_id","id","kind"),
	CONSTRAINT "chats_nonnegative_sequence" CHECK ("chats"."last_message_sequence" >= 0),
	CONSTRAINT "chats_nonnegative_task_number" CHECK ("chats"."last_task_number" >= 0),
	CONSTRAINT "chats_kind" CHECK ("chats"."kind" in ('channel', 'dm', 'thread')),
	CONSTRAINT "chats_shape" CHECK ((
                (
                    "chats"."kind" = 'channel'
                    and "chats"."name" is not null
                    and "chats"."dm_agent_id" is null
                    and "chats"."dm_member_one_stint" is null
                    and "chats"."dm_member_one_user_id" is null
                    and "chats"."dm_member_two_stint" is null
                    and "chats"."dm_member_two_user_id" is null
                    and "chats"."parent_chat_id" is null
                    and "chats"."parent_chat_kind" is null
                    and "chats"."anchor_message_id" is null
                    and (not "chats"."is_all" or "chats"."name" = 'all')
                )
                or (
                    "chats"."kind" = 'dm'
                    and "chats"."name" is null
                    and "chats"."is_all" = false
                    and "chats"."dm_member_one_stint" is not null
                    and "chats"."dm_member_one_user_id" is not null
                    and "chats"."parent_chat_id" is null
                    and "chats"."parent_chat_kind" is null
                    and "chats"."anchor_message_id" is null
                    and (
                        (
                            "chats"."dm_agent_id" is null
                            and "chats"."dm_member_two_stint" is not null
                            and "chats"."dm_member_two_user_id" is not null
                            and "chats"."dm_member_one_user_id" < "chats"."dm_member_two_user_id"
                        )
                        or (
                            "chats"."dm_agent_id" is not null
                            and "chats"."dm_member_two_stint" is null
                            and "chats"."dm_member_two_user_id" is null
                        )
                    )
                )
                or (
                    "chats"."kind" = 'thread'
                    and "chats"."name" is null
                    and "chats"."is_all" = false
                    and "chats"."dm_agent_id" is null
                    and "chats"."dm_member_one_stint" is null
                    and "chats"."dm_member_one_user_id" is null
                    and "chats"."dm_member_two_stint" is null
                    and "chats"."dm_member_two_user_id" is null
                    and "chats"."parent_chat_id" is not null
                    and "chats"."parent_chat_kind" in ('channel', 'dm')
                    and "chats"."anchor_message_id" is not null
                )
            ))
);
--> statement-breakpoint
CREATE TABLE "computer_login_grants" (
	"approved_at" timestamp with time zone,
	"approved_by_clerk_user_id" text,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_code_hash" text NOT NULL,
	"denied_at" timestamp with time zone,
	"denied_by_clerk_user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"polling_interval_ms" integer NOT NULL,
	"purpose" text DEFAULT 'login' NOT NULL,
	"status" text NOT NULL,
	"user_code_hash" text NOT NULL,
	CONSTRAINT "computer_login_grants_id_shape" CHECK ("computer_login_grants"."id" ~ '^dgr_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "computer_login_grants_device_code_hash_shape" CHECK ("computer_login_grants"."device_code_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "computer_login_grants_user_code_hash_shape" CHECK ("computer_login_grants"."user_code_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "computer_login_grants_polling_interval_positive" CHECK ("computer_login_grants"."polling_interval_ms" > 0),
	CONSTRAINT "computer_login_grants_status" CHECK ("computer_login_grants"."status" in ('pending', 'approved', 'denied', 'expired', 'consumed')),
	CONSTRAINT "computer_login_grants_purpose" CHECK ("computer_login_grants"."purpose" in ('login', 'setup'))
);
--> statement-breakpoint
CREATE TABLE "computer_login_refresh_tokens" (
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"revoked_at" timestamp with time zone,
	"session_id" text NOT NULL,
	"token_hash" text NOT NULL,
	CONSTRAINT "computer_login_refresh_tokens_id_shape" CHECK ("computer_login_refresh_tokens"."id" ~ '^crt_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "computer_login_refresh_tokens_token_hash_shape" CHECK ("computer_login_refresh_tokens"."token_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "computer_login_sessions" (
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"access_token_hash" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"grant_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"refresh_token_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"stored_at" timestamp with time zone,
	CONSTRAINT "computer_login_sessions_id_shape" CHECK ("computer_login_sessions"."id" ~ '^cls_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "computer_login_sessions_access_token_hash_shape" CHECK ("computer_login_sessions"."access_token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "computer_login_sessions_refresh_token_hash_shape" CHECK ("computer_login_sessions"."refresh_token_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "computers" (
	"architecture" text,
	"attached_by_user_id" text NOT NULL,
	"attachment_idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"credential_hash" text NOT NULL,
	"health" text DEFAULT 'offline' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"last_connected_at" timestamp with time zone,
	"operating_system" text,
	"product_version" text,
	"protocol_version" integer,
	"reported_inventory" jsonb,
	"usage_reported_at" timestamp with time zone,
	"usage_snapshot" jsonb,
	"server_id" text NOT NULL,
	"update_active_agent_count" integer,
	"update_detail" text,
	"update_downloaded_bytes" integer,
	"update_failed_phase" text,
	"update_phase" text DEFAULT 'idle' NOT NULL,
	"update_target_version" text,
	"update_total_bytes" integer,
	"update_updated_at" timestamp with time zone,
	CONSTRAINT "computers_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "computers_id_shape" CHECK ("computers"."id" ~ '^cmp_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "computers_credential_hash_shape" CHECK ("computers"."credential_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "computers_health" CHECK ("computers"."health" in ('offline', 'healthy', 'degraded', 'update-required')),
	CONSTRAINT "computers_attachment_idempotency_key_shape" CHECK ("computers"."attachment_idempotency_key" IS NULL OR "computers"."attachment_idempotency_key" ~ '^cak_[A-Za-z0-9_-]{43}$'),
	CONSTRAINT "computers_update_phase" CHECK ("computers"."update_phase" in ('idle', 'checking', 'available', 'requested', 'downloading', 'verifying', 'installing', 'waiting-for-agents', 'restarting', 'complete', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "agent_mcp_connection_grants" (
	"agent_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_id" text NOT NULL,
	CONSTRAINT "agent_mcp_connection_grants_server_id_agent_id_connection_id_pk" PRIMARY KEY("server_id","agent_id","connection_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_connections" (
	"account_label" text,
	"auth" text NOT NULL,
	"connected" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"header_names" text[] NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"preset" text,
	"server_id" text NOT NULL,
	"tools" text[] NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "mcp_connections_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "mcp_connections_id_shape" CHECK ("mcp_connections"."id" ~ '^mcp_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "mcp_connections_auth" CHECK ("mcp_connections"."auth" in ('none', 'headers', 'oauth')),
	CONSTRAINT "mcp_connections_preset" CHECK ("mcp_connections"."preset" is null or "mcp_connections"."preset" in ('google-calendar', 'merchbase'))
);
--> statement-breakpoint
CREATE TABLE "mcp_secrets" (
	"connection_id" text PRIMARY KEY NOT NULL,
	"secret" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"actor_agent_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"emoji" text NOT NULL,
	"message_id" text NOT NULL,
	"server_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_task_labels" (
	"label_id" text NOT NULL,
	"message_id" text NOT NULL,
	"server_id" text NOT NULL,
	CONSTRAINT "message_task_labels_server_id_message_id_label_id_pk" PRIMARY KEY("server_id","message_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "message_tasks" (
	"assignee_user_id" text,
	"assignee_agent_id" text,
	"chat_id" text NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_agent_id" text,
	"created_by_user_id" text,
	"message_id" text NOT NULL,
	"number" integer NOT NULL,
	"origin" text NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"server_id" text NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "message_tasks_server_id_message_id_pk" PRIMARY KEY("server_id","message_id"),
	CONSTRAINT "message_tasks_creator_shape" CHECK (num_nonnulls("message_tasks"."created_by_user_id", "message_tasks"."created_by_agent_id") = 1),
	CONSTRAINT "message_tasks_assignee_shape" CHECK (num_nonnulls("message_tasks"."assignee_user_id", "message_tasks"."assignee_agent_id") <= 1),
	CONSTRAINT "message_tasks_positive_number" CHECK ("message_tasks"."number" > 0),
	CONSTRAINT "message_tasks_positive_version" CHECK ("message_tasks"."version" > 0),
	CONSTRAINT "message_tasks_status" CHECK ("message_tasks"."status" in ('todo', 'in_progress', 'in_review', 'done', 'closed')),
	CONSTRAINT "message_tasks_priority" CHECK ("message_tasks"."priority" in ('none', 'urgent', 'high', 'medium', 'low')),
	CONSTRAINT "message_tasks_origin" CHECK ("message_tasks"."origin" in ('composed', 'converted')),
	CONSTRAINT "message_tasks_claim_shape" CHECK ("message_tasks"."claimed_at" is null or num_nonnulls("message_tasks"."assignee_user_id", "message_tasks"."assignee_agent_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "reminder_agent_attention" (
	"agent_id" text NOT NULL,
	"anchor_chat_id" text NOT NULL,
	"fire_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"attention_kind" text NOT NULL,
	"queued_at" timestamp with time zone NOT NULL,
	"receipt_message_id" text NOT NULL,
	"reminder_id" text NOT NULL,
	"script" text,
	"server_id" text NOT NULL,
	CONSTRAINT "reminder_agent_attention_shape" CHECK ((
                ("reminder_agent_attention"."attention_kind" = 'reminder' AND "reminder_agent_attention"."script" IS NULL)
                OR
                ("reminder_agent_attention"."attention_kind" = 'reminder_script'
                    AND octet_length("reminder_agent_attention"."script") between 1 and 16384)
            ))
);
--> statement-breakpoint
CREATE TABLE "reminder_commands" (
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_kind" text NOT NULL,
	"applied_version" integer NOT NULL,
	"command_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"reminder_id" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"result_snapshot" jsonb NOT NULL,
	"server_id" text NOT NULL,
	CONSTRAINT "reminder_commands_actor_kind" CHECK ("reminder_commands"."actor_kind" in ('agent', 'user')),
	CONSTRAINT "reminder_commands_positive_version" CHECK ("reminder_commands"."applied_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "reminder_fires" (
	"fired_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"script_exit_code" integer,
	"script_output" text,
	"script_timed_out" boolean DEFAULT false NOT NULL,
	"receipt_message_id" text NOT NULL,
	"reminder_id" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"server_id" text NOT NULL,
	CONSTRAINT "reminder_fires_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "reminder_fires_script_output_size" CHECK ("reminder_fires"."script_output" is null or octet_length("reminder_fires"."script_output") <= 65536)
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"anchor_chat_id" text NOT NULL,
	"anchor_message_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"fire_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"owner_agent_id" text NOT NULL,
	"repeat" text,
	"schedule_receipt_message_id" text,
	"script" text,
	"server_id" text NOT NULL,
	"status" text NOT NULL,
	"timezone" text NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "reminders_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "reminders_status" CHECK ("reminders"."status" in ('scheduled', 'fired', 'canceled')),
	CONSTRAINT "reminders_positive_version" CHECK ("reminders"."version" > 0),
	CONSTRAINT "reminders_title_length" CHECK (char_length("reminders"."title") between 1 and 300),
	CONSTRAINT "reminders_script_size" CHECK ("reminders"."script" is null or (
                octet_length("reminders"."script") between 1 and 16384
            ))
);
--> statement-breakpoint
CREATE TABLE "server_deletions" (
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error" text,
	"id" text PRIMARY KEY NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"server_id" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "server_deletions_id_shape" CHECK ("server_deletions"."id" ~ '^sdl_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "server_deletions_status" CHECK ("server_deletions"."status" in ('pending', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "server_invitations" (
	"accepted_at" timestamp with time zone,
	"accepted_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"server_id" text NOT NULL,
	"token_hash" text NOT NULL,
	CONSTRAINT "server_invitations_email_normalized" CHECK ("server_invitations"."email" = lower("server_invitations"."email") and "server_invitations"."email" <> ''),
	CONSTRAINT "server_invitations_terminal" CHECK (("server_invitations"."accepted_at" is null) = ("server_invitations"."accepted_user_id" is null)
                and not ("server_invitations"."accepted_at" is not null and "server_invitations"."revoked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "server_memberships" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"role" text NOT NULL,
	"server_id" text NOT NULL,
	"stint" integer DEFAULT 1 NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "server_memberships_server_user_key" UNIQUE("server_id","user_id"),
	CONSTRAINT "server_memberships_role" CHECK ("server_memberships"."role" in ('owner', 'admin', 'member')),
	CONSTRAINT "server_memberships_positive_stint" CHECK ("server_memberships"."stint" > 0)
);
--> statement-breakpoint
CREATE TABLE "server_onboarding" (
	"agent_id" text,
	"application_id" text,
	"channel_id" text NOT NULL,
	"channel_kind" text DEFAULT 'channel' NOT NULL,
	"computer_id" text,
	"failure_code" text,
	"failure_detail" text,
	"model_id" text,
	"phase" text NOT NULL,
	"runtime_id" text,
	"server_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "server_onboarding_server_id_pk" PRIMARY KEY("server_id"),
	CONSTRAINT "server_onboarding_channel_kind" CHECK ("server_onboarding"."channel_kind" = 'channel'),
	CONSTRAINT "server_onboarding_phase" CHECK ("server_onboarding"."phase" in ('awaiting-computer', 'awaiting-cove', 'applying', 'complete')),
	CONSTRAINT "server_onboarding_failure_shape" CHECK (("server_onboarding"."failure_code" is null) = ("server_onboarding"."failure_detail" is null)),
	CONSTRAINT "server_onboarding_failure_code" CHECK ("server_onboarding"."failure_code" is null or "server_onboarding"."failure_code" in ('computer-disconnected', 'computer-incompatible', 'inventory-empty', 'inventory-invalid', 'application-failed')),
	CONSTRAINT "server_onboarding_cove_shape" CHECK (("server_onboarding"."agent_id" is null and "server_onboarding"."application_id" is null and "server_onboarding"."runtime_id" is null and "server_onboarding"."model_id" is null) or ("server_onboarding"."agent_id" is not null and "server_onboarding"."application_id" is not null and "server_onboarding"."runtime_id" is not null and "server_onboarding"."model_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"display_name" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"last_chat_event_cursor" bigint DEFAULT 0 NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "servers_nonnegative_chat_event_cursor" CHECK ("servers"."last_chat_event_cursor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "task_labels" (
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"server_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_labels_server_id_id_pk" PRIMARY KEY("server_id","id"),
	CONSTRAINT "task_labels_color" CHECK ("task_labels"."color" in ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'))
);
--> statement-breakpoint
CREATE TABLE "thread_follows" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"followed" boolean DEFAULT true NOT NULL,
	"server_id" text NOT NULL,
	"thread_chat_id" text NOT NULL,
	"thread_chat_kind" text DEFAULT 'thread' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "thread_follows_server_id_thread_chat_id_user_id_pk" PRIMARY KEY("server_id","thread_chat_id","user_id"),
	CONSTRAINT "thread_follows_kind" CHECK ("thread_follows"."thread_chat_kind" = 'thread')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"avatar_id" text,
	"clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"display_name" text,
	"email" text,
	"handle" text,
	"id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_channel_mutes" ADD CONSTRAINT "agent_channel_mutes_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_channel_mutes" ADD CONSTRAINT "agent_channel_mutes_chat_fk" FOREIGN KEY ("server_id","chat_id","chat_kind") REFERENCES "public"."chats"("server_id","id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_thread_follows" ADD CONSTRAINT "agent_thread_follows_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_thread_follows" ADD CONSTRAINT "agent_thread_follows_thread_fk" FOREIGN KEY ("server_id","thread_chat_id","thread_chat_kind") REFERENCES "public"."chats"("server_id","id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_delivery" ADD CONSTRAINT "agent_delivery_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_delivery" ADD CONSTRAINT "agent_delivery_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_work" ADD CONSTRAINT "agent_pending_work_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_work" ADD CONSTRAINT "agent_pending_work_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_work" ADD CONSTRAINT "agent_pending_work_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_inbox_cursors" ADD CONSTRAINT "agent_inbox_cursors_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_inbox_cursors" ADD CONSTRAINT "agent_inbox_cursors_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_inbox_pierces" ADD CONSTRAINT "agent_inbox_pierces_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_inbox_pierces" ADD CONSTRAINT "agent_inbox_pierces_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_inbox_pierces" ADD CONSTRAINT "agent_inbox_pierces_message_fk" FOREIGN KEY ("server_id","message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_message_drafts" ADD CONSTRAINT "agent_message_drafts_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_message_drafts" ADD CONSTRAINT "agent_message_drafts_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_lookup_audit" ADD CONSTRAINT "manual_lookup_audit_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_lookup_audit" ADD CONSTRAINT "manual_lookup_audit_server_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runner_credentials" ADD CONSTRAINT "agent_runner_credentials_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runner_credentials" ADD CONSTRAINT "agent_runner_credentials_computer_fk" FOREIGN KEY ("server_id","computer_id") REFERENCES "public"."computers"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runner_credentials" ADD CONSTRAINT "agent_runner_credentials_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runner_credentials" ADD CONSTRAINT "agent_runner_credentials_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD CONSTRAINT "agent_turns_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD CONSTRAINT "agent_turns_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD CONSTRAINT "agent_turns_computer_fk" FOREIGN KEY ("server_id","computer_id") REFERENCES "public"."computers"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_avatar_id_avatars_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."avatars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_computer_fk" FOREIGN KEY ("server_id","computer_id") REFERENCES "public"."computers"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_membership_fk" FOREIGN KEY ("server_id","uploader_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_agent_fk" FOREIGN KEY ("server_id","uploader_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_fk" FOREIGN KEY ("server_id","chat_id","message_id") REFERENCES "public"."chat_messages"("server_id","chat_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_reminder_fk" FOREIGN KEY ("server_id","reminder_id") REFERENCES "public"."reminders"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_message_fk" FOREIGN KEY ("server_id","message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_reader_membership_fk" FOREIGN KEY ("server_id","reader_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_membership_fk" FOREIGN KEY ("server_id","author_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_agent_fk" FOREIGN KEY ("server_id","author_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reads" ADD CONSTRAINT "chat_reads_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reads" ADD CONSTRAINT "chat_reads_reader_membership_fk" FOREIGN KEY ("server_id","reader_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_agent_participants" ADD CONSTRAINT "channel_agent_participants_chat_fk" FOREIGN KEY ("server_id","chat_id","chat_kind") REFERENCES "public"."chats"("server_id","id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_agent_participants" ADD CONSTRAINT "channel_agent_participants_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_participants" ADD CONSTRAINT "channel_participants_chat_fk" FOREIGN KEY ("server_id","chat_id","chat_kind") REFERENCES "public"."chats"("server_id","id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_participants" ADD CONSTRAINT "channel_participants_membership_fk" FOREIGN KEY ("server_id","user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_dm_member_one_membership_fk" FOREIGN KEY ("server_id","dm_member_one_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_dm_member_two_membership_fk" FOREIGN KEY ("server_id","dm_member_two_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_thread_parent_fk" FOREIGN KEY ("server_id","parent_chat_id","parent_chat_kind") REFERENCES "public"."chats"("server_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_dm_agent_fk" FOREIGN KEY ("server_id","dm_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computer_login_refresh_tokens" ADD CONSTRAINT "computer_login_refresh_tokens_session_id_computer_login_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."computer_login_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computer_login_sessions" ADD CONSTRAINT "computer_login_sessions_grant_id_computer_login_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."computer_login_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computers" ADD CONSTRAINT "computers_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computers" ADD CONSTRAINT "computers_attacher_membership_fk" FOREIGN KEY ("server_id","attached_by_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mcp_connection_grants" ADD CONSTRAINT "agent_mcp_connection_grants_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mcp_connection_grants" ADD CONSTRAINT "agent_mcp_connection_grants_connection_fk" FOREIGN KEY ("server_id","connection_id") REFERENCES "public"."mcp_connections"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_secrets" ADD CONSTRAINT "mcp_secrets_connection_id_mcp_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mcp_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_fk" FOREIGN KEY ("server_id","message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_actor_agent_fk" FOREIGN KEY ("server_id","actor_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_task_labels" ADD CONSTRAINT "message_task_labels_task_fk" FOREIGN KEY ("server_id","message_id") REFERENCES "public"."message_tasks"("server_id","message_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_task_labels" ADD CONSTRAINT "message_task_labels_label_fk" FOREIGN KEY ("server_id","label_id") REFERENCES "public"."task_labels"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_message_fk" FOREIGN KEY ("server_id","chat_id","message_id") REFERENCES "public"."chat_messages"("server_id","chat_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_creator_membership_fk" FOREIGN KEY ("server_id","created_by_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_creator_agent_fk" FOREIGN KEY ("server_id","created_by_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_assignee_membership_fk" FOREIGN KEY ("server_id","assignee_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_assignee_agent_fk" FOREIGN KEY ("server_id","assignee_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_agent_attention" ADD CONSTRAINT "reminder_agent_attention_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_agent_attention" ADD CONSTRAINT "reminder_agent_attention_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_agent_attention" ADD CONSTRAINT "reminder_agent_attention_reminder_fk" FOREIGN KEY ("server_id","reminder_id") REFERENCES "public"."reminders"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_agent_attention" ADD CONSTRAINT "reminder_agent_attention_fire_fk" FOREIGN KEY ("server_id","fire_id") REFERENCES "public"."reminder_fires"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_agent_attention" ADD CONSTRAINT "reminder_agent_attention_anchor_chat_fk" FOREIGN KEY ("server_id","anchor_chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_agent_attention" ADD CONSTRAINT "reminder_agent_attention_receipt_fk" FOREIGN KEY ("server_id","receipt_message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_commands" ADD CONSTRAINT "reminder_commands_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_commands" ADD CONSTRAINT "reminder_commands_reminder_fk" FOREIGN KEY ("server_id","reminder_id") REFERENCES "public"."reminders"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_fires" ADD CONSTRAINT "reminder_fires_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_fires" ADD CONSTRAINT "reminder_fires_reminder_fk" FOREIGN KEY ("server_id","reminder_id") REFERENCES "public"."reminders"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_fires" ADD CONSTRAINT "reminder_fires_receipt_fk" FOREIGN KEY ("server_id","receipt_message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_owner_agent_fk" FOREIGN KEY ("server_id","owner_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_anchor_chat_fk" FOREIGN KEY ("server_id","anchor_chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_anchor_message_fk" FOREIGN KEY ("server_id","anchor_chat_id","anchor_message_id") REFERENCES "public"."chat_messages"("server_id","chat_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_schedule_receipt_fk" FOREIGN KEY ("server_id","schedule_receipt_message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_deletions" ADD CONSTRAINT "server_deletions_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_invitations" ADD CONSTRAINT "server_invitations_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_invitations" ADD CONSTRAINT "server_invitations_inviter_membership_fk" FOREIGN KEY ("server_id","invited_by_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_invitations" ADD CONSTRAINT "server_invitations_accepted_membership_fk" FOREIGN KEY ("server_id","accepted_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_memberships" ADD CONSTRAINT "server_memberships_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_memberships" ADD CONSTRAINT "server_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_onboarding" ADD CONSTRAINT "server_onboarding_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_onboarding" ADD CONSTRAINT "server_onboarding_channel_fk" FOREIGN KEY ("server_id","channel_id","channel_kind") REFERENCES "public"."chats"("server_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_onboarding" ADD CONSTRAINT "server_onboarding_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_onboarding" ADD CONSTRAINT "server_onboarding_computer_fk" FOREIGN KEY ("server_id","computer_id") REFERENCES "public"."computers"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_follows" ADD CONSTRAINT "thread_follows_thread_fk" FOREIGN KEY ("server_id","thread_chat_id","thread_chat_kind") REFERENCES "public"."chats"("server_id","id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_follows" ADD CONSTRAINT "thread_follows_membership_fk" FOREIGN KEY ("server_id","user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_avatars_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."avatars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_pending_work_dedupe_key" ON "agent_pending_work" USING btree ("server_id","agent_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "agent_pending_work_queue_idx" ON "agent_pending_work" USING btree ("server_id","agent_id","created_at");--> statement-breakpoint
CREATE INDEX "manual_lookup_audit_server_time_idx" ON "manual_lookup_audit" USING btree ("server_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_runner_credentials_agent_idx" ON "agent_runner_credentials" USING btree ("server_id","agent_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_turns_run_key" ON "agent_turns" USING btree ("server_id","agent_id","run_id");--> statement-breakpoint
CREATE INDEX "agent_turns_agent_idx" ON "agent_turns" USING btree ("server_id","agent_id","reported_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_server_handle_key" ON "agents" USING btree ("server_id",lower("handle"));--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_server_id_key" ON "attachments" USING btree ("server_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_user_nonce_key" ON "attachments" USING btree ("server_id","uploader_user_id","upload_nonce") WHERE "attachments"."uploader_user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_agent_nonce_key" ON "attachments" USING btree ("server_id","uploader_agent_id","upload_nonce") WHERE "attachments"."uploader_agent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_message_position_key" ON "attachments" USING btree ("server_id","message_id","message_position") WHERE "attachments"."message_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_events_server_cursor_key" ON "chat_events" USING btree ("server_id","cursor");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_chat_sequence_key" ON "chat_messages" USING btree ("server_id","chat_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_chat_nonce_key" ON "chat_messages" USING btree ("server_id","chat_id","nonce");--> statement-breakpoint
CREATE INDEX "chat_messages_chat_sequence_idx" ON "chat_messages" USING btree ("server_id","chat_id","sequence");--> statement-breakpoint
CREATE INDEX "chat_messages_search_idx" ON "chat_messages" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "channel_participants_user_idx" ON "channel_participants" USING btree ("server_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chats_server_channel_name_key" ON "chats" USING btree ("server_id","name") WHERE "chats"."kind" = 'channel';--> statement-breakpoint
CREATE UNIQUE INDEX "chats_server_dm_pair_key" ON "chats" USING btree ("server_id","dm_member_one_user_id","dm_member_two_user_id","dm_member_one_stint","dm_member_two_stint") WHERE "chats"."kind" = 'dm';--> statement-breakpoint
CREATE UNIQUE INDEX "chats_server_agent_dm_key" ON "chats" USING btree ("server_id","dm_member_one_user_id","dm_member_one_stint","dm_agent_id") WHERE "chats"."kind" = 'dm' and "chats"."dm_agent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "chats_server_all_key" ON "chats" USING btree ("server_id") WHERE "chats"."is_all" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "chats_server_thread_anchor_key" ON "chats" USING btree ("server_id","parent_chat_id","anchor_message_id") WHERE "chats"."kind" = 'thread';--> statement-breakpoint
CREATE UNIQUE INDEX "computer_login_grants_device_code_hash_key" ON "computer_login_grants" USING btree ("device_code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "computer_login_grants_user_code_hash_key" ON "computer_login_grants" USING btree ("user_code_hash");--> statement-breakpoint
CREATE INDEX "computer_login_grants_expiry_idx" ON "computer_login_grants" USING btree ("expires_at","status");--> statement-breakpoint
CREATE UNIQUE INDEX "computer_login_refresh_tokens_token_hash_key" ON "computer_login_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "computer_login_refresh_tokens_session_idx" ON "computer_login_refresh_tokens" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "computer_login_sessions_grant_key" ON "computer_login_sessions" USING btree ("grant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "computer_login_sessions_access_token_hash_key" ON "computer_login_sessions" USING btree ("access_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "computer_login_sessions_refresh_token_hash_key" ON "computer_login_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "computer_login_sessions_owner_idx" ON "computer_login_sessions" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "computers_credential_hash_key" ON "computers" USING btree ("credential_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "computers_attachment_idempotency_key" ON "computers" USING btree ("attachment_idempotency_key");--> statement-breakpoint
CREATE INDEX "computers_server_idx" ON "computers" USING btree ("server_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_actor_key" ON "message_reactions" USING btree ("server_id","message_id","actor_agent_id","emoji");--> statement-breakpoint
CREATE UNIQUE INDEX "message_tasks_chat_number_key" ON "message_tasks" USING btree ("server_id","chat_id","number");--> statement-breakpoint
CREATE INDEX "message_tasks_chat_status_idx" ON "message_tasks" USING btree ("server_id","chat_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_agent_attention_server_id_key" ON "reminder_agent_attention" USING btree ("server_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_agent_attention_fire_key" ON "reminder_agent_attention" USING btree ("server_id","fire_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_commands_actor_command_key" ON "reminder_commands" USING btree ("server_id","actor_kind","actor_id","command_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_fires_logical_fire_key" ON "reminder_fires" USING btree ("server_id","reminder_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("fire_at","id") WHERE "reminders"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX "server_deletions_requester_idx" ON "server_deletions" USING btree ("requested_by_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "server_invitations_token_hash_key" ON "server_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "server_invitations_live_email_key" ON "server_invitations" USING btree ("server_id","email") WHERE "server_invitations"."revoked_at" is null and "server_invitations"."accepted_at" is null;--> statement-breakpoint
CREATE INDEX "server_invitations_server_idx" ON "server_invitations" USING btree ("server_id","created_at");--> statement-breakpoint
CREATE INDEX "server_memberships_user_idx" ON "server_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "server_onboarding_application_key" ON "server_onboarding" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "server_onboarding_channel_key" ON "server_onboarding" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "servers_slug_key" ON "servers" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "task_labels_server_name_key" ON "task_labels" USING btree ("server_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_key" ON "users" USING btree ("handle") WHERE "users"."handle" is not null;