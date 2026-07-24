---
summary: Tavern architecture layers for App, API, SDK, Runtime, SQLite state, AI SDK agent execution, and event recovery.
read_when:
  - changing the boundary between Tavern App and Tavern Runtime
  - changing realtime recovery, Runtime data flow, or managed runtime ownership
---

# Architecture Overview

Tavern is a chat app for humans and agents. Runtime is the product backend.
Agent executors are implementation details behind Runtime.

```mermaid
flowchart LR
    app["Tavern App<br/>Electron + React"]
    server["Tavern Server<br/>tRPC and app cache"]
    sdk["@tavern/api + SDK<br/>typed contracts"]
    runtime["Tavern Runtime<br/>canonical chat + agent state"]
    db["Runtime SQLite"]
    engine["Agent engine<br/>AI SDK HarnessAgent"]

    app <--> server
    server <--> sdk
    sdk <--> runtime
    runtime <--> db
    runtime <--> engine
```

## Layers

| Layer | Owns |
| --- | --- |
| Tavern App | Electron shell, React routes, local presentation, optimistic UI, and app-local cache. |
| Tavern Server | Thin tRPC facade, app cache, connection setup, and UI-friendly projections. |
| Tavern API / SDK | Stable contracts for chats, realtime, agents, models, tools, jobs, and Runtime admin. |
| Tavern Runtime | Canonical Chats, messages, participants, Agent sessions, Agent turns, model provider setup, executable model inventory, tools, inbox delivery, and execution. |
| Agent engine | Runtime-internal execution through AI SDK HarnessAgent adapters. |

## Product Model

- A **Chat** is a durable conversation container. It can be a channel or a DM.
- A **Chat participant** is a human, Agent, system actor, or external actor in a
  Chat.
- An **Agent seat** is an Agent participant in a Chat.
- An **Agent session** is the current execution context for one Agent seat.
- An **Agent turn** is one execution attempt inside an Agent session.

The Chat timeline is canonical product state. Agent execution traces are
evidence, not the product timeline.

## Runtime Boundary

Runtime is the source of truth for values that affect execution:

- model provider setup
- executable model inventory
- Agent default model
- current Agent session
- Agent session effective model
- MCP connection configuration and credentials
- exact per-agent MCP and host-tool grants
- sandbox mode
- turn queue and turn status
- inbox delivery cursors and assistant messages

Tavern App and Server must not reconstruct those values from UI state or a
random chatroom. Settings that change execution call Runtime. Headless clients
can perform the same actions through Runtime API.

## Execution Boundary

Runtime executes every Agent turn through model record `executionKind: harness`.

- Claude Code and Codex use their native AI SDK harness adapters.
- OpenAI and OpenAI-compatible API-key models use the Pi harness adapter.

Executors write their own reply messages by running `grotto message send`
(ADR 0014) rather than through a Runtime chat-write API. Execution evidence
(prompt, file changes) is recorded as turn metadata and surfaced on the agent
profile, not as chat activity. Provider-specific details remain metadata.

## Recovery

Realtime streams are delivery paths, not storage. If a browser reconnects, it
refetches durable Runtime chat state and subscribes to active turn events.
Runtime must settle failed, cancelled, and interrupted turns as durable Tavern
state.

## References

- [ADR 0007](../adr/0007-chat-participants-own-agent-sessions.md)
- [Agent Engine Runtime](agent-engine-runtime.md)
- [Data Model](data-model.md)
- [Realtime](../api/realtime.md)
