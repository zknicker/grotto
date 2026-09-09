ALTER TABLE "triggers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "triggers_deleted_idx" ON "triggers" USING btree ("server_id","deleted_at");--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_deleted_status" CHECK ("triggers"."deleted_at" is null or "triggers"."status" = 'disabled');