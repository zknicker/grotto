# Chat Timeline And Turn Evidence

The chat timeline is the conversation. Agent execution is evidence at agent
level. They are separate models with separate contracts, and they never mix
in one projection. Amended by
[ADR 0014](../docs/adr/0014-cli-is-the-agents-only-output-channel.md): agents
speak only via `grotto message send`, so the timeline carries no turn-shaped
rows at all.

## Product Expectations

- A chat reads like a conversation between participants. Humans and agents
  contribute messages; Server-authored system receipts (including task
  creation/promotion, session resets, and thread notices) render as quiet
  centered lines; nothing else appears as a timeline unit.
- An agent message is an explicit send, immutable once committed. There are
  no edits, no streamed replacements, no silent-turn placeholders.
- The only live chat-level signal is the **typing indicator**
  ([typing-indicators.md](typing-indicators.md)): an ephemeral near-composer cue for human
  composition and Agent Chat engagement. Typing is never persisted and never enters durable
  caches or the transcript.

## Timeline Contract

- The chat timeline projection (`chat.log.list`) returns conversation units
  only: participant messages (user/assistant/system roles) with their
  attachments, thread anchors (reply counts), and date boundaries.
- Execution rows — tool calls, reasoning, narration, turn lifecycle —
  never appear. There are no work groups, no streaming message states, no
  per-turn response rows.
- Every timeline unit renders at its natural size; the timeline never
  contains units that render empty.
- The timeline is append-only from the reader's seat: a new unit only ever
  appears at the end, and no unit ever moves.

## Execution Evidence

- Summarized turn evidence anchors to the Agent's real `runId` and surfaces in Agent Activity
  History. Agent-authored messages retain that run identity so their Turn Details drawer can show
  the same access-safe summary.
- Server Owners and Admins may explicitly request the detailed Computer-local execution journal
  from Turn Details while Computer is online. Opening a Chat never performs that read.
- Execution rows never become transcript units. The drawer is inspection UI attached to a durable
  message, not part of the conversation projection.
- Live agent state (busy dot, activity strip text) is presence
  ([presence.md](presence.md)), agent-scoped.

## Boundaries

- Runtime owns both models: canonical messages and durable turn records.
- The server exposes them through separate procedures with separate
  schemas.
- External frontends consume the timeline contract and may ignore typing entirely while still
  seeing a consistent Chat.
