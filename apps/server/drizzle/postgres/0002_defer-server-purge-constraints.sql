-- A Server purge deletes the Server root and lets PostgreSQL cascade through
-- every Server-owned row. Cross-links between those descendants must be
-- checked after the full cascade, not midway through its internal trigger
-- order. Ordinary parent deletes still fail at transaction commit when their
-- referencing rows remain.

ALTER TABLE "attachments" ALTER CONSTRAINT "attachments_uploader_agent_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "chat_messages" ALTER CONSTRAINT "chat_messages_author_agent_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "chats" ALTER CONSTRAINT "chats_dm_agent_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "message_tasks" ALTER CONSTRAINT "message_tasks_assignee_agent_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "message_tasks" ALTER CONSTRAINT "message_tasks_creator_agent_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reminder_agent_attention" ALTER CONSTRAINT "reminder_agent_attention_agent_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reminders" ALTER CONSTRAINT "reminders_owner_agent_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "server_onboarding" ALTER CONSTRAINT "server_onboarding_agent_fk" DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "attachments" ALTER CONSTRAINT "attachments_message_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "chats" ALTER CONSTRAINT "chats_thread_anchor_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reminder_agent_attention" ALTER CONSTRAINT "reminder_agent_attention_receipt_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reminder_fires" ALTER CONSTRAINT "reminder_fires_receipt_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reminders" ALTER CONSTRAINT "reminders_anchor_message_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reminders" ALTER CONSTRAINT "reminders_schedule_receipt_fk" DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "chats" ALTER CONSTRAINT "chats_thread_parent_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reminder_agent_attention" ALTER CONSTRAINT "reminder_agent_attention_anchor_chat_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "reminders" ALTER CONSTRAINT "reminders_anchor_chat_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "server_onboarding" ALTER CONSTRAINT "server_onboarding_channel_fk" DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "agents" ALTER CONSTRAINT "agents_computer_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "server_onboarding" ALTER CONSTRAINT "server_onboarding_computer_fk" DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "attachments" ALTER CONSTRAINT "attachments_uploader_membership_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "chat_messages" ALTER CONSTRAINT "chat_messages_author_membership_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "chats" ALTER CONSTRAINT "chats_dm_member_one_membership_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "chats" ALTER CONSTRAINT "chats_dm_member_two_membership_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "computers" ALTER CONSTRAINT "computers_attacher_membership_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "message_tasks" ALTER CONSTRAINT "message_tasks_assignee_membership_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "message_tasks" ALTER CONSTRAINT "message_tasks_creator_membership_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "server_invitations" ALTER CONSTRAINT "server_invitations_accepted_membership_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "server_invitations" ALTER CONSTRAINT "server_invitations_inviter_membership_fk" DEFERRABLE INITIALLY DEFERRED;
