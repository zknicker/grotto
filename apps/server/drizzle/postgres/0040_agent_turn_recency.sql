-- The Inbox reads every turn a Server started inside a recency window and
-- refetches it on each settled Agent lifecycle event. Without a `server_id`,
-- `started_at` index that read scans every turn the Server ever recorded.
CREATE INDEX "agent_turns_started_idx" ON "agent_turns" USING btree ("server_id","started_at");