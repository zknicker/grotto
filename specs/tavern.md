# Grotto

Grotto is an always-on agent chat system backed by Grotto Runtime.

## Product Expectations

- Grotto feels like one coherent product around its own product model.
- Grotto Runtime keeps chats, automations, deliveries, and event history alive while the app is
  closed.
- Grotto defines its own product surfaces such as agents, chats, sessions, turns, automations,
  models, memories, and jobs.
- The local agent engine participates in those Grotto surfaces through Runtime
  rather than redefining them.
- The app shell is stable, with a top bar, a persistent left rail, and a main workspace.
- The left rail remains visible across the main product areas rather than disappearing on route
  changes.

## Local-First Behavior

- Grotto App renders the best Runtime-backed state immediately from cache, then reconciles with
  Grotto Runtime.
- Agent execution evidence appears through Grotto Runtime records.
- Runtime records track freshness.
- If a full Runtime sync omits a runtime-native record, Grotto removes that current
  record.
- Agent history such as sessions, transcripts, logs, and run events remains useful as
  evidence and is not deleted merely because a later sync does not mention it.

## Config And Runtime Facts

- Grotto Runtime owns shared services such as chat, memory, automations, delivery, jobs,
  model routing, provider state, executable agent settings, sessions, turns, transcripts,
  logs, tools, and agent files.
- Grotto App owns first-party client presentation, cache, and app-shell preferences.
- Grotto stores what happened during agent execution as Runtime evidence.

## Runtime Relationship

- The local agent engine is managed inside Grotto Runtime.
- Agent-engine behavior maps cleanly into Grotto's named primitives rather than redefining them.
- Grotto Runtime manages the supported local product path; Grotto App is only a client.
