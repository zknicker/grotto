# Runtime Data Flow

Tavern Runtime owns the product data model that the Tavern App reads. The local agent engine is a
Runtime implementation detail: Runtime runs agents, tools, sessions, and turns, then exposes
app-facing facts through Runtime APIs and events when Tavern needs to render or inspect them later.

## Model

- Tavern Runtime owns chats, messages, participants, events, reads, automations, deliveries,
  runtime activity, memory, generated agent instruction inputs, executable settings, and
  operational jobs.
- Tavern App owns React Query cache, presentation state, optimistic UI, and app-shell preferences.
- Tavern API / SDK exposes stable chat, realtime, automation, admin, Runtime control, memory, skill,
  MCP connection, stats, and tool-grant contracts.
- Tavern Runtime owns native agent execution, sessions, turns, transcripts, logs, agent files, tool
  calls, model calls, context management, and applied native config.
- Runtime persists any agent-produced data Tavern may render, inspect, recover, or navigate later.
- Product screens read through focused Runtime-backed APIs such as `chat.list`, `chat.get`,
  `chat.log.list`, `session.list`, `cron.list`, `agent.list`, and participant APIs.
- React Query is the app cache. It is refreshed by write responses, exact cache updates, focused
  invalidations, and narrow realtime subscriptions.
- Jobs represent real scheduled operational work. They are not the data transport between Runtime
  storage and app screens.

## Runtime Data Ownership

| Product data | Owner | Read path | Freshness signal |
| --- | --- | --- | --- |
| `agent` | Runtime agent records and capabilities | `agent.*` APIs | `agent.onUpdate` |
| `chat` | Runtime chat records | `chat.*` APIs | `chat.onUpdate` |
| `chat log` | Runtime messages, responses, activity, artifacts, and receipts | `chat.log.*` APIs | `chat.log.onUpdate`, turn events |
| `participant` | Runtime-ingested source identities and observed labels | participant APIs | chat and runtime sync events |
| `session` | Runtime session, history, and execution evidence | `session.*` APIs | `session.onUpdate`, turn events |
| `cron` | Runtime automation configuration and run history | `cron.*` APIs | `cron.onUpdate` |
| `config` | Tavern-owned settings applied by Runtime | focused settings/config APIs | config, model, skill, and runtime events |
| `usage` | External provider imports | usage APIs and job history | provider usage jobs and `usage.onLiveUpdate` |

## Runtime Records

- Runtime records use stable product ids or stable source ids from the owning runtime or external
  system.
- Runtime evidence rows include the stable agent runtime namespace when the source is the local
  agent engine.
- Runtime adapters normalize source-specific chat, participant, session, and tool facts before data
  reaches product records.
- Tavern chat history is Runtime state. Agent transcripts are execution evidence, not the product
  timeline.
- Agent turns attach to Runtime-owned Tavern chats through agent participants and current
  agent session ids.
- Tavern stores enough runtime evidence to keep the app useful across reloads and Runtime restarts.
- Runtime connectivity is health/capability state, not a separate app-side data source.
- Product screens compose Runtime records from focused APIs. If Runtime is offline, screens render
  the best cached React Query data they already have and show focused freshness or error affordances.

## Managed Config

- Tavern Runtime generates agent instructions and executable settings from Runtime-owned state.
- If Runtime recreates agent-engine state, it reapplies generated config before accepting work that
  depends on that config.
- Tavern preserves Tavern-owned overlays such as agent color separately from runtime-native records.
- Tavern does not treat generated agent-engine files as canonical product settings.
- Runtime-owned config saves call Runtime, persist the returned product state, and emit focused
  invalidation events for affected screens.

## Observed Execution History

- Observed execution history includes sessions, turns, tool calls, model calls, logs, cron runs,
  worker activity, and recoverable response activity.
- Observed history remains labeled with its source runtime or external system.
- Observed history is upserted by stable source identifiers.
- Observed history survives agent-engine reinstall/reset when Runtime storage is preserved.
- Runtime writes accepted messages, active responses, and response activity before notifying clients.
  A hard reload after send acceptance can recover the accepted user message, active response, and
  already observed activity even before the final assistant message exists.

## Writes

- Tavern-originated writes call the focused Runtime API for the product action.
- A successful write response may update React Query cache directly when the returned shape is exact.
- Write handlers emit focused events for other mounted clients and nearby screens.
- Runtime-originated edits or observations write Runtime storage first, then emit focused events.
- Event echoes are not required for Tavern-originated writes to be considered successful.
- If a write fails, Tavern reports the failure and leaves the previous durable record intact unless
  the user explicitly retries or deletes it.

## Events

- Runtime event streams use WebSockets.
- Events identify the affected product primitive and stable id when one exists.
- Events may include a complete payload or an invalidation hint.
- Event subscriptions are scoped narrowly: examples include `chat.onUpdate`, `chat.log.onUpdate`,
  `session.onUpdate`, `cron.onUpdate`, and turn progress/completion events.
- App event hooks own the exact React Query cache update or invalidation for that event.
- Websocket events are freshness signals. Durable state must be recoverable through Runtime reads,
  cursor replay, or both.
- Clients may use optimistic rows for speed, but reconciliation must be possible from durable ids and
  Runtime reads.

## Jobs

- Jobs are visible operational scheduled work with run history.
- Provider usage imports are jobs because they poll external providers on a real schedule and expose
  operational failures.
- Runtime domain data does not become a job just because app screens need to read it.
- A future job is appropriate when the work is scheduled, operator-visible, retryable, and not already
  covered by a focused API write or event-driven Runtime ingestion path.

## Failure Behavior

- Runtime connectivity problems do not blank the app when cached records already exist.
- Runtime/API errors are visible and attributable to the affected capability.
- Failed reads or writes do not delete previously observed history.
- Failed Runtime ingestion does not mutate Tavern-owned overlays.
