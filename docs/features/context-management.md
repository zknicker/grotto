---
summary: Fresh-session instruction composition and persistent Agent context.
read_when:
  - changing generated Agent instructions or model-family directives
  - changing session resume, reset, model switching, or recovery
---

# Context Management

Context management composes the instructions for an Agent's single global
model session. Per-turn message delivery is an inbox concern; see
[Agent Inbox](../../specs/inbox.md).

## Contract

- Computer composes managed product instructions, the Agent description,
  assigned skills, and tool guidance when a fresh model session starts.
- Model-family operational directives are appended only for models that need
  them.
- Instructions include current time, home timezone, and the rule that old
  context and prior data reads must be rechecked.
- The model session spans every Chat the Agent participates in and resumes
  between deliveries and Computer restarts.
- Sessions never rotate because of age or idle time.
- A fresh session starts only for initial creation, a runtime or model switch,
  manual session reset, or one automatic recovery after the harness rejects a
  stored resume state.
- The first delivery to a fresh session begins with `Start.`. Later deliveries
  resume the same session without replaying that marker.
- Restart recreates the Agent runner and resumes the same native conversation.
  Its next delivery applies the latest composed instructions once without
  rotating the session generation or replaying `Start.`.
- Session reset preserves workspace, memory notes, skills, identity, and
  Server history. Full reset restores the factory starter kit.

Durable Agent knowledge lives in the Agent-owned workspace (`MEMORY.md` and
notes), not an injected memory system. Agents read older canonical Chat history
through the `grotto` CLI when inbox delivery is insufficient.

The Server stores desired configuration and canonical history. Computer stores
effective harness state and resume evidence. The App reports that distinction
instead of inferring session health from process presence.
