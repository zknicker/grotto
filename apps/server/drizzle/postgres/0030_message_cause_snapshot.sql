-- A message's provenance mark now outlives the automation that provoked it.
-- The mark's facts -- title, cadence or kind label, fire time, owning Agent,
-- and the anchor Chat -- are snapshotted onto the cause when it is recorded,
-- and the automation and fire ids stop cascading the row away: they carry no
-- foreign key at all now, so they keep naming the history that provoked the
-- message once the Trigger, Reminder, or fire row is gone. Existing rows are
-- backfilled from the live records they still join to, reproducing the same
-- summary derivation the read path used before this.
ALTER TABLE "message_causes" DROP CONSTRAINT "message_causes_trigger_fk";--> statement-breakpoint
ALTER TABLE "message_causes" DROP CONSTRAINT "message_causes_trigger_fire_fk";--> statement-breakpoint
ALTER TABLE "message_causes" DROP CONSTRAINT "message_causes_reminder_fk";--> statement-breakpoint
ALTER TABLE "message_causes" DROP CONSTRAINT "message_causes_reminder_fire_fk";--> statement-breakpoint
ALTER TABLE "message_causes" ADD COLUMN "anchor_chat_id" text;--> statement-breakpoint
ALTER TABLE "message_causes" ADD COLUMN "fired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message_causes" ADD COLUMN "owner_agent_id" text;--> statement-breakpoint
ALTER TABLE "message_causes" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "message_causes" ADD COLUMN "title" text;--> statement-breakpoint
UPDATE "message_causes" AS c
SET "anchor_chat_id" = t."anchor_chat_id",
    "fired_at" = f."received_at",
    "owner_agent_id" = t."owner_agent_id",
    "summary" = CASE t."kind" WHEN 'webhook' THEN 'Webhook' ELSE t."kind" END,
    "title" = t."title"
FROM "triggers" AS t, "trigger_fires" AS f
WHERE c."kind" = 'trigger_fire'
  AND t."server_id" = c."server_id" AND t."id" = c."trigger_id"
  AND f."server_id" = c."server_id" AND f."id" = c."trigger_fire_id";--> statement-breakpoint
UPDATE "message_causes" AS c
SET "anchor_chat_id" = r."anchor_chat_id",
    "fired_at" = f."fired_at",
    "owner_agent_id" = r."owner_agent_id",
    "summary" = CASE
        WHEN r."repeat" IS NULL THEN 'One time'
        WHEN r."repeat" ~ '^daily@[0-9]{2}:[0-9]{2}$'
            THEN 'Every day at ' || substring(r."repeat" from '([0-9]{2}:[0-9]{2})$')
        WHEN r."repeat" ~ '^weekly:[a-z,]+@[0-9]{2}:[0-9]{2}$'
            THEN 'Every ' || (
                SELECT string_agg(d."name", ', ' ORDER BY d."index")
                FROM (VALUES
                    ('sun', 0, 'Sunday'), ('mon', 1, 'Monday'), ('tue', 2, 'Tuesday'),
                    ('wed', 3, 'Wednesday'), ('thu', 4, 'Thursday'), ('fri', 5, 'Friday'),
                    ('sat', 6, 'Saturday')
                ) AS d("token", "index", "name")
                WHERE d."token" = ANY(
                    string_to_array(substring(r."repeat" from '^weekly:([a-z,]+)@'), ',')
                )
            ) || ' at ' || substring(r."repeat" from '([0-9]{2}:[0-9]{2})$')
        WHEN r."repeat" ~ '^every:[0-9]+[mhd]$' THEN 'Every ' || (
            SELECT CASE
                WHEN "minutes" % 1440 = 0 THEN
                    CASE WHEN "minutes" / 1440 = 1 THEN 'day'
                         ELSE ("minutes" / 1440) || ' days' END
                WHEN "minutes" % 60 = 0 THEN
                    CASE WHEN "minutes" / 60 = 1 THEN 'hour'
                         ELSE ("minutes" / 60) || ' hours' END
                WHEN "minutes" = 1 THEN 'minute'
                ELSE "minutes" || ' minutes'
            END
            FROM (
                SELECT (substring(r."repeat" from '^every:([0-9]+)')::bigint) * CASE
                    substring(r."repeat" from '([mhd])$')
                    WHEN 'm' THEN 1 WHEN 'h' THEN 60 ELSE 1440
                END AS "minutes"
            ) AS "interval_minutes"
        )
        ELSE r."repeat"
    END,
    "title" = r."title"
FROM "reminders" AS r, "reminder_fires" AS f
WHERE c."kind" = 'reminder_fire'
  AND r."server_id" = c."server_id" AND r."id" = c."reminder_id"
  AND f."server_id" = c."server_id" AND f."id" = c."reminder_fire_id";--> statement-breakpoint
ALTER TABLE "message_causes" ALTER COLUMN "fired_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_causes" ALTER COLUMN "owner_agent_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_causes" ALTER COLUMN "summary" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_causes" ALTER COLUMN "title" SET NOT NULL;
