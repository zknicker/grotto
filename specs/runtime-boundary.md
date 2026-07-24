# Runtime Boundary

Tavern owns the product surfaces it presents, even when connected runtimes own the underlying
execution state.

## Product Ownership

- Tavern defines its own nouns such as agents, chats, sessions, turns, cron, events, memories,
  models, jobs, skills, and tools.
- Tavern avoids leaking runtime-specific product language into its primary UI when a Tavern noun
  already exists.
- Tavern preserves its own distinction between chats, sessions, and turns even if a runtime exposes
  those concepts differently.
- Ownership is per domain.
- Tavern Runtime-owned domains include chats, messages, events, reads, automations, deliveries,
  memory, runtime health, sync state, generated config policy, and jobs.
- Tavern App-owned domains include client cache, app-shell preferences, and presentation overlays.
- Tavern Runtime-owned execution domains include sessions, turns, transcripts, logs, skills,
  tools, model routing, channel bindings, and provider secrets. The local agent engine is an
  implementation detail behind Runtime APIs.

## Runtime Expectations

- Tavern maps runtime data into Tavern product behavior and terminology.
- Tavern App edits runtime-owned config through supported Runtime APIs.
- Tavern does not maintain duplicate canonical records for runtime-owned config.
- Runtime-native edits remain valid and refresh Tavern through sync and events.
- Periodic sync refreshes runtime evidence and observed history. It does not make runtime-native
  config canonical Tavern state.

## Tavern Expectations

- Tavern stays useful when a runtime is offline by rendering existing Tavern records and observed
  history.
- Tavern identifies the runtime source for runtime-backed records.
- Tavern makes sync freshness and failures visible without exposing raw runtime internals.
