---
summary: Fresh-session instruction composition and persistent Agent context.
read_when:
  - changing generated Agent instructions
  - changing session resume, reset, model switching, or recovery
---

# Context Management

Context management composes the instructions for an Agent's single global
model session. Per-turn message delivery is an inbox concern; see
[Agent Inbox](../../specs/inbox.md).

## Contract

- Computer composes managed product instructions, the Agent description,
  assigned skills, and tool guidance when a fresh model session starts.
- Computer does not append Grotto-specific model-family steering. Every model receives the same
  managed product contract; executor-native instructions remain owned by that executor.
- Instructions include current time, home timezone, and the rule that old
  context and prior data reads must be rechecked.
- The model session spans every Chat the Agent participates in and resumes
  between deliveries and Computer restarts.
- Sessions never rotate because of age or idle time.
- A fresh session starts only for initial creation, a runtime, model, or reasoning-effort switch,
  manual session reset, or one automatic recovery after the harness rejects a stored resume state.
- An execution-configuration change never interrupts an active turn. The active turn finishes
  with its frozen runtime, model, and reasoning effort; Server then rotates the session, applies
  the new configuration, and uses it for the next turn.
- A fresh session with pending work uses its notice or typed attention as the
  first prompt. `Start.` is used only when no delivery is pending. Later
  deliveries resume the same session without replaying that marker.
- A committed action attention is an identity-addressed typed continuation for
  the proposing Agent. Same-run reconnect replay suppresses an already-consumed
  action result; a failed new run reoffers it. Action attention has no Chat
  cursor, and creating an Agent does not schedule an empty bootstrap turn.
- Restart recreates the Agent runner and resumes the same native conversation.
  Its next delivery applies the latest composed instructions once without
  rotating the session generation or replaying `Start.`.
- Session reset preserves workspace, memory, skills, identity, and Server
  history. Full reset restores an ordinary Agent's minimal `MEMORY.md` and
  factory-managed skills.

Durable Agent knowledge lives in the Agent-owned workspace (`MEMORY.md` and
notes), not an injected memory system. Agents read older canonical Chat history
through the `grotto` CLI when inbox delivery is insufficient.

The Server stores desired configuration and canonical history. Computer stores
effective harness state and resume evidence. The App reports that distinction
instead of inferring session health from process presence.
