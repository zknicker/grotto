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
  assigned skills, and tool guidance for every accepted turn. It persists the
  applied instruction and Harness bootstrap fingerprints with the resumed session.
- Computer does not append Grotto-specific model-family steering. Every model receives the same
  managed product contract; executor-native instructions remain owned by that executor.
- Instructions include current time, home timezone, and the rule that old
  context and prior data reads must be rechecked.
- The model session spans every Chat the Agent participates in and resumes
  between deliveries and Computer restarts.
- Sessions never rotate because of age or idle time.
- The Harness supplies current composed instructions on every accepted turn. When the persisted
  instruction fingerprint differs, the same native conversation therefore adopts them without
  adapter rotation. Bootstrap drift or Restart parks the adapter at the turn boundary, applies the
  current content-addressed bootstrap, and resumes that conversation. Activity History records the
  update as started, completed, or failed without prompt text, local paths, commands, or hashes.
- Before Cove turns, Computer also reconciles recognized prior factory revisions of the playbook
  and FAQ. It never replaces Cove's memory, objectives, missing files, or edited guidance. A
  successful reconciliation gives the current session a one-turn private re-read notice; conflicts
  remain visible as failed instruction-update activity while the turn continues.
- Fingerprints advance only after the refreshed turn successfully detaches with new resume state.
  A bootstrap or turn failure keeps the previous receipt and session generation so a later delivery
  can retry. Only rejection of the stored native resume state enters Server-authorized session
  recovery; Computer never silently discards conversation context.
- The independently released Grotto Agent version is the public receipt for this managed behavior,
  including instructions, actions, recipes and Manual content, Harness bootstrap, and factory
  guidance. Version drift uses the same next-turn refresh path. Computer marks the version current
  only after a successful turn, preserves the previous applied version on failure, and reports the
  pending/current/failed state to Server for the Agent profile. Exact fingerprints remain
  Computer-local implementation evidence.
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
  Its next delivery uses the same refresh path without rotating the session generation or
  replaying `Start.`.
- Session reset preserves workspace, memory, skills, identity, and Server
  history. Full reset restores an ordinary Agent's minimal `MEMORY.md` and
  factory-managed skills.

Durable Agent knowledge lives in the Agent-owned workspace (`MEMORY.md` and
notes), not an injected memory system. Agents read older canonical Chat history
through the `grotto` CLI when inbox delivery is insufficient.

The Server stores desired configuration and canonical history. Computer stores
effective harness state and resume evidence. The App reports that distinction
instead of inferring session health from process presence.
