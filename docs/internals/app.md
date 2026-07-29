---
summary: Tavern App boundary for the Electron product shell, React/tRPC client, app cache, presentation state, runtime adapters, and optimistic UI rules.
read_when:
  - changing the local app backend, tRPC procedures, client cache, or app-owned settings
  - changing how Tavern App consumes Tavern Runtime or Tavern API records
---

# Tavern App

The hosted React App is Grotto's canonical product surface. Browsers load it
directly from `grotto.sh`; the Electron desktop app is a thin native shell that
loads the same hosted App. Electron adds only native window behavior, system
links, native Clerk token storage, deep links, and desktop updates through a
narrow preload bridge.

The packaged desktop artifact does not contain a second copy of the product UI.
Only the exact configured App origin may navigate inside the shell or invoke
native IPC. UI fixes therefore reach browsers and desktop windows together when
the hosted App is promoted; a signed desktop release is required only when the
Electron shell or preload bridge changes.

Tavern App must not gain execution ownership from the agent-engine integration.
Anything a headless Runtime API client needs to run the agent belongs to
Runtime. The app can proxy, translate, cache, and render; it cannot become the
source of truth for agent behavior.

## Ownership

* **API procedures stay thin.** Validate input, call product logic, and return a
  narrow result.
* **Product logic owns product nouns.** Chat, agents, automations, skills,
  stats, and settings live under their capability, not under generic service
  folders.
* **Chat history is runtime-owned.** Tavern Runtime owns chats, messages,
  participants, sequence, events, reads, soft deletes, and the product timeline.
* **Agent records are runtime-owned.** Tavern App lists, reads, and edits agents
  through first-class Tavern APIs hosted by Runtime. App storage may keep
  presentation overlays, but it does not decide whether an agent exists.
* **Agent execution settings are runtime-owned.** Provider setup, executable
  model inventory, selected model, skill assignments, MCP connections, exact
  tool grants, instructions, sessions, turns, presence, and the activity feed
  come from Runtime. App settings screens invoke Runtime API mutations; they
  do not maintain a separate executable config.
* **Runtime adapters stay behind adapters.** Agent-engine payloads and
  MCP transport details do not leak into product domains.
* **Settings save through Runtime.** App settings call narrow mutations such as
  agent name, model, thinking default, and messaging binding updates. The app
  does not maintain a global agent-engine config draft or send arbitrary config
  JSON for user-facing settings.
* **App storage is cache and presentation.** App screens can cache runtime
  records and app-shell preferences, but runtime durable reads recover after the
  app has been closed.
* **Optimistic UI is presentation state.** It can bridge one-frame chat handoffs,
  but it must not become durable chat history.

## Data Shape

App storage includes client cache, presentation state, and app-shell
preferences.
Canonical chat, agent, participant, session, and execution evidence records
belong in Tavern Runtime.

Keep table names in product language. Attach runtime ownership with columns such
  as `runtime_id`, `source`, or `last_synced_at`; do not create adapter-shaped
table families for first-party Tavern behavior.

## Capability State

Settings screens read current runtime capability state from normal tRPC queries
when they open. They subscribe to capability invalidation events only while that
surface is mounted, then let React Query refetch the current state.

The app setup gate is first-time setup only. If an enabled Tavern Runtime
connection exists in app storage, the app opens the dashboard even when Runtime
is disconnected or version-mismatched. Runtime health, update, and capability
problems surface inside the normal app shell.

Runtime-owned transitions, such as agent-engine readiness or model/skill
inventory refreshes, emit `agent-runtime-capability.updated` from Tavern
Runtime. App-observed capability checks write through the capability status
recorder, which emits the same app invalidation event when the persisted
capability state changes.

Do not use broad startup refreshes or global polling to keep capability UI
current. The flow is current query data plus capability-specific events.

## Boundaries

* Runtime ownership: [runtime.md](runtime.md)
* Tavern API contracts: [../api/README.md](../api/README.md)
* TypeScript SDK: [../sdk.md](../sdk.md)
* Testing rules: [../operations/testing.md](../operations/testing.md)
