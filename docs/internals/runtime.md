---
summary: Grotto Runtime internals for chat storage, Agent seats, Agent sessions, AI SDK execution, persistence, inbox delivery, and tool boundaries.
read_when:
  - changing the always-on chat server
  - changing agent execution or Runtime ownership
  - changing inbox delivery, execution evidence, managed workspace instructions, or agent-facing Grotto tools
---

# Runtime

Grotto Runtime is the always-on local service behind Grotto. It owns canonical
Chat records, participants, reads, inbox delivery, Agent sessions, Agent
turns, tool inventory, model provider setup, executable model inventory, and
agent execution.

Grotto App is one frontend. Discord, Telegram, webhooks, SDK clients, and
future surfaces are also frontends. They all talk to Runtime through Grotto Chat
and Agent-session contracts.

## Ownership

- **Runtime owns Chat state.** Messages, participants, reads, and inbox
  delivery cursors live in Runtime SQLite.
- **Runtime owns Agent routing.** A Chat agent participant is an Agent seat with
  a current Agent session binding.
- **Runtime owns execution.** It resolves the current Agent session, chooses the
  model executor, runs the turn, and lets the agent write its own reply
  messages through the Grotto CLI (`grotto message send`).
- **Runtime owns model selection.** Agent profiles store defaults for new
  sessions; Agent sessions store effective models for that Chat.
- **Runtime owns tools.** Enabled tools are auto-approved and run inside the
  configured sandbox mode.

App and Server may cache and present this state, but they must not invent
session ids, model routes, provider availability, or execution policy.

## Execution

Runtime executes turns through the agent-engine path described in
[Agent Engine Runtime](agent-engine-runtime.md).

- Claude Code and Codex use AI SDK HarnessAgent.
- OpenAI and OpenAI-compatible records use the Pi HarnessAgent adapter.
- Browser e2e uses a deterministic fake executor installed by the e2e runtime
  bootstrap, not a model provider route.
- Sandbox mode `none` uses `.tavern/agents/<agent-id>/workspace` as a trusted
  working directory.
- Fresh ordinary Agent workspaces are seeded by
  `packages/agent-workspace/src/starter-kit.ts` with only a minimal
  `MEMORY.md` containing identity, description-derived role, empty knowledge,
  and initial active context. Seeding skips workspaces that already have a
  `MEMORY.md`; a full reset recreates that file and the factory-managed
  `visuals` skill.
- Tool calls are auto-approved. There is no interactive approval prompt.

## Persistence

Durable Runtime state includes:

- `chats`
- `chat_participants`
- `chat_messages`
- `agent_sessions`
- `agent_turns`
- `agent_turn_file_changes`
- `agent_inbox_cursors`, `agent_session_served_cursors`
- `agent_channel_mutes`, `agent_inbox_pierces`, `thread_follows`
- `agent_message_drafts`
- `agent_runtime_profiles`
- model provider, access, inventory, and selection tables

`chat_responses`, `chat_response_activity`, and `chat_deliveries` remain
real, schema-backed tables the Chat API can still write and read, but real
agent turns no longer populate them (see [Chat API](../api/chat.md)).

Active stream handles, process handles, cancellation controllers, and executor
promises are transient Runtime memory. Reconnect recovery reads durable Chat
state and active turn state rather than trusting the browser stream as history.

## Ingestion

All frontends create Grotto Chat messages. Agents never write chat replies
directly — Runtime's delivery planner is the only path from a durable message
to agent execution:

- A `message.created` event is planned per attention rules: joined channels,
  followed threads, and DMs deliver ordinarily; a channel mute suppresses the
  channel and its threads; a personal @mention pierces a mute as a single
  delivery. See [Agent Inbox](../../specs/inbox.md).
- An idle agent gets a drain turn batching every pending target; a busy agent
  gets a content-free notice instead.
- Agents speak only by running `grotto message send` from inside a turn — the
  engine exposes no chat-sending tool. See
  [ADR 0014](../adr/0014-cli-is-the-agents-only-output-channel.md).

## Boundaries

Runtime records source facts and execution evidence. Grotto App owns final UI
presentation. Runtime adapters must not author display-only workspace folders,
fake participants, or provider labels that are not source facts.

If a Runtime record is missing a required stable id, timestamp, actor, schedule,
file content, or model route, fail the mapping or mark the capability degraded.
Do not invent values to keep the UI moving.
