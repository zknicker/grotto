# Runtime Sessions

Runtime sessions preserve ongoing execution context across turns.

## Product Expectations

- A runtime session keeps enough context for an agent to continue a conversation over time.
- Sessions survive individual turns instead of resetting after every message when the runtime
  supports continuity.
- Session continuity should survive runtime restart where possible.
- Sessions remain scoped so unrelated conversations do not bleed together.

## Session Shape

- A session belongs to a conversation context.
- A session belongs to a specific agent within that conversation context.
- A chat with multiple agents may therefore have multiple active sessions.
- A cron job may run in an isolated session or a reusable session depending on runtime behavior and
  job configuration.

## Behavior

- A new conversation starts a new session when no suitable session exists.
- A continuing conversation reuses the correct session when possible.
- A user should experience continuity within an ongoing conversation.
- Grotto should be able to inspect whether work reused an existing session or created a new one
  when the runtime reports that information.
- Grotto can inspect sessions through stable session snapshots and ordered session message
  snapshots.
- Session snapshots distinguish `sessionKey`, the stable routing/reference key, from `sessionId`,
  the runtime transcript identity. Runtime-backed Grotto sessions expose that transcript identity
  as `session.id`.
- Session message snapshots may include execution metadata such as model, provider, and token usage.
- Grotto can observe live session and message updates through the runtime WebSocket event stream.

## Constraints

- Session identity is not the same thing as agent identity.
- Session identity is not the same thing as chat identity.
- Session reuse should never cause one agent's context to leak into another agent's context.
