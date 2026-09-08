-- Preserve the text people saw before removing the second commentary field.
UPDATE chat_messages AS message
SET content = action.proposal ->> 'draftHint'
FROM prepared_actions AS action
WHERE action.kind = 'agent:create'
  AND action.server_id = message.server_id
  AND action.chat_id = message.chat_id
  AND action.message_id = message.id
  AND message.content !~ '[^[:space:]]'
  AND jsonb_typeof(action.proposal -> 'draftHint') = 'string'
  AND action.proposal ->> 'draftHint' ~ '[^[:space:]]';
--> statement-breakpoint
UPDATE prepared_actions
SET proposal = proposal - 'draftHint'
WHERE kind = 'agent:create' AND proposal ? 'draftHint';
