-- Whether a reminder ran a script belongs to the fire, not to the reminder.
-- A reminder gains or loses its script at any time, so history read the live
-- `reminders.script` and relabelled fires that had already settled. Existing
-- rows recover the flag from the only evidence a script leaves behind: a
-- recorded exit code or a timeout.
ALTER TABLE "reminder_fires" ADD COLUMN "has_script" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "reminder_fires" SET "has_script" = true
WHERE "script_exit_code" IS NOT NULL OR "script_timed_out";
