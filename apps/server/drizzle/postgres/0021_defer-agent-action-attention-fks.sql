-- Server deletion cascades through every action-attention parent. Defer these
-- cross-links so PostgreSQL validates them after the cascade has completed.

ALTER TABLE "agent_action_attentions" ALTER CONSTRAINT "agent_action_attentions_server_id_servers_id_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "agent_action_attentions" ALTER CONSTRAINT "agent_action_attentions_action_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "agent_action_attentions" ALTER CONSTRAINT "agent_action_attentions_agent_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "agent_action_attentions" ALTER CONSTRAINT "agent_action_attentions_chat_fk" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "agent_action_attentions" ALTER CONSTRAINT "agent_action_attentions_created_agent_fk" DEFERRABLE INITIALLY DEFERRED;
