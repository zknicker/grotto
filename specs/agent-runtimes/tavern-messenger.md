---
summary: Tavern frontend channel contract for routing chat messages to Tavern Agent seats.
read_when:
  - changing Tavern App chat send behavior
  - changing Agent seats, Agent sessions, or agent-channel dispatch
  - changing how Runtime maps agent execution into durable Tavern chat records
---

# Tavern Agent Channel

Tavern App is one first-party chat frontend for Tavern agents and humans. It
does not share transcript state with Discord, Telegram, CLI, or SDK frontends.
Each frontend can talk to the same Tavern agents through its own channel and its
own conversation history.

## Position

```text
Tavern App
  -> Tavern Server
  -> Tavern Runtime Chat API
  -> Tavern agent channel
  -> agent engine session
```

Tavern Runtime owns canonical chats, participants, messages, events, responses,
activity, reads, Agent seats, Agent sessions, and Agent turns. Tavern App and Tavern
Server proxy and present Runtime state; they do not own executable agent state.

## Agent Seats And Sessions

An agent participant in a Chat is the Agent seat:

```text
ChatParticipant
  chatId
  id
  kind: agent
```

An `AgentSession` is the agent's one global execution context:

```text
AgentSession
  id
  agentId
  generation
  effectiveModel
  runtimeSessionId
  resumeState
  status: active | archived | stopped
```

The Agent seat is stable product state. The Agent session is agent-global
(`specs/sessions.md`): one ongoing session per agent spans every chat. A
fresh session starts only on a model switch, a manual reset from agent
settings, or a long fully idle gap; starting one archives the previous
active session and does not remove the agent from any chat.

## Send Flow

1. Tavern App creates a client message id and renders an app-local optimistic
   user row.
2. Tavern Server calls Runtime `POST /api/chats/{chatId}/messages` through the
   Runtime client. The target identifies the Tavern chat and selected agent; it
   does not include caller-provided engine routing ids.
3. Runtime validates the chat and agent, resolves the Agent seat, ensures the
   current Agent session, writes the durable user message, and creates a
   running response.
4. Runtime dispatches the message to the generated Tavern agent channel with
   the current Agent session and Tavern message context.
5. Runtime returns an accepted receipt with `runId`. Run ids derive from the
   message id plus the agent id, so one message mentioning several agents fans
   out into one distinct turn and response per mentioned agent.
6. The channel streams engine events back to Runtime. Runtime maps assistant
   output into durable response, activity, and assistant message records.
7. Tavern App reconciles optimistic rows from durable chat reads and realtime
   events. Missed websocket notifications are recovered by refetching Runtime
   chat history and events.

There is no private Tavern outbox table and no Tavern chat session key. The
Agent session id is the durable execution context for a Tavern Agent seat, and
the Agent turn id identifies one execution attempt.

## Metadata

Runtime stores agent execution facts under `metadata.runtime`:

```json
{
  "runtime": {
    "source": "agent-engine",
    "agentId": "agt_primary",
    "agentSessionId": "ags_cht_tavern_agent_dm_agt_primary_1",
    "runId": "run_123_primary",
    "engineSessionId": "ses_..."
  }
}
```

`agentSessionId` is Tavern Runtime execution state for the Agent seat. Engine
session ids and resume state are execution evidence, not product routing
identity.

## Frontend Boundaries

* Tavern App chat messages appear in Tavern App.
* Discord messages appear in Discord.
* A future Telegram or SDK channel owns its own conversation ids and delivery.
* Shared agents, model configuration, skills, exact tool grants, and Memory
  reads live in Tavern Runtime, not in individual frontend clients.

Human-only chat messages are valid Tavern messages. They invoke an agent only
when Runtime routes them to an Agent seat, such as through selected-agent send,
mention routing, command routing, or automation.

## Commands

Session resets are agent-wide and live in agent settings
(`specs/sessions.md`); frontends do not expose per-chat session commands.
Clearing a chat timeline is a chat operation and does not touch the agent's
session.

Stop and steering controls target the active Runtime turn. Runtime maps those
controls to engine APIs when available and reports unsupported controls as
normal failed or declined Runtime operations.
