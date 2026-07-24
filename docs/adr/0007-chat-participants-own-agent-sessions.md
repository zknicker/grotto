---
summary: Decision to model Tavern agents as chat participants with current Agent sessions.
read_when:
  - changing Tavern chat, channel, or DM architecture
  - changing agent session routing or model switching
  - changing AI SDK, harness, or local workspace execution
  - changing tool source exposure or sandbox policy
---

# ADR 0007: Chat Participants Own Agent Sessions

## Status

Partially superseded by
[ADR 0011](0011-agents-own-one-global-session.md): session ownership moved
from the Agent seat to the agent (one global session per agent). The
chat/participant/turn-evidence contracts below remain in force.

## Context

Tavern is a Discord-style chat app. Channels and DMs are first-class Chat
containers where humans, agents, system actors, and external actors can
participate. DMs are one-to-one. Tavern Chat is the product boundary; agent
executors are Runtime implementation details.

OpenClaw's session model is useful precedent: a stable conversation bucket maps
to a current rotating session id. Tavern keeps that shape without string session
keys by using the agent's Chat participant row as the stable bucket.

## Decision

An Agent's Chat participant is its durable **Agent seat** in that Chat. The
Agent seat owns exactly one current Agent session pointer.

```text
Chat
  type: channel | dm
  participants:
    user participant
    agent participant -> currentAgentSessionId

AgentSession
  id: Tavern-owned session id
  chatParticipantId: agent seat
  effectiveModel: model used by turns in this session
  runtimeSessionId: optional executor id
  resumeState: optional opaque executor resume state
  status: active | archived | stopped

AgentTurn
  sessionId
  triggeringMessageId
  status
  attempt
```

Agent addressing decides when an Agent seat creates an Agent turn. A normal
channel message is just a message. The first implementation supports mentions
and one-to-one DMs with an agent. Future commands, automations, or explicit
channel listener configuration may create turns. Multiple addressed agents
create independent turns.

An Agent seat serializes its own turns. One agent participant in one Chat has
at most one active turn; additional addressed messages queue for that seat.
Different Agent seats in the same Chat may run concurrently, and human messages
may continue while agents are working.

The Chat timeline is canonical product state. Agent turns and turn activity are
execution evidence. Agent responses that users read are normal Chat messages
authored by the agent participant.

Active streaming is separate from durable Chat history. Runtime stores
transient active turn state for in-progress turns and writes completed or
checkpointed messages and activity into the durable Chat timeline. Reconnecting
clients recover by refetching durable Chat state and resubscribing to active
turn streams. Stopping a turn is a Runtime command, not merely closing a browser
stream.

Tavern's durable chat and realtime contracts are Tavern-native. Executor
implementations may consume or produce AI SDK UI message streams internally when
that reduces adapter work, but Tavern does not store Chat history as AI SDK
`UIMessage[]` and does not expose AI SDK stream parts as its durable product API.

Model records describe concrete runnable model routes. Claude Code, Codex,
OpenAI, and OpenAI-compatible records execute through AI SDK HarnessAgent
adapters. Agent runtime profiles select a default model record and assign tool,
memory, and execution policies; they do not duplicate model execution kind.

Agent runtime profiles supply the default model for new sessions. Each Agent
session stores its effective model. Settings changes update the profile
default. Chat-scoped model switches mutate that Agent seat's current session,
not every Chat using the same Agent definition. If the current executor can
switch models in-session, the switch applies on the next clean turn. Runtime
rotates to a new Agent session only when the user starts fresh context for that
Agent seat.

Tavern does not expose interactive tool approval prompts. Enabled tools are
auto-approved unless Runtime adds a narrower approval policy. Harness tools
come from the selected executor. Runtime supplies host tools through exact
host-tool grants and relays MCP tools through exact per-agent, per-connection
tool grants. Safety is expressed through Sandbox mode. Under Sandbox mode
`none`, enabled local tools imply full host trust.

The first Sandbox mode is `none`: a trusted local workspace under the Runtime
data root, such as `.tavern/agents/<agent-id>/workspace`. This is organization
and working-directory scoping only; it is not a security sandbox. Future
Sandbox modes can include Docker and Podman.

The Runtime provider catalog is curated. Claude Code and Codex can appear in
add-provider UI before local OAuth CLI setup exists. Runtime exposes them as
executable models only after provider access is ready.

## Consequences

- Reserve "presence" for future online/idle/offline liveness, not session
  routing.
- Use one noun for execution attempts: Agent turn. Do not introduce Agent run as
  a second API concept.
- Runtime owns Chat participants, current Agent session pointers, Agent sessions,
  Agent turns, model selection state, and opaque executor resume state.
- Durable Chat history must remain correct if an active stream is interrupted
  or lost; the turn can be marked interrupted or recoverable.
- AI SDK UI hooks and stream helpers are implementation tools, not the Tavern
  App or Tavern API data model.
- The first UI can omit default-listener agents. Users invoke channel agents by
  mention and talk to one agent directly through a one-to-one DM.
- App, Discord, Telegram, SDK clients, and future frontends route through
  Tavern Chat/participant/session contracts instead of executor-specific ids.
- Sandbox mode `none` gives full host trust to tools that can execute shell
  commands or read arbitrary paths. UI and docs must label it as no sandbox.
- Runtime must return a capability error for Docker or Podman sandbox modes
  until those providers are implemented and tested.
