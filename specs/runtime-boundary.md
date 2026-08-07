# Runtime Boundary

Grotto owns the product surfaces it presents, even when connected runtimes own the underlying
execution state.

## Product Ownership

- Grotto defines its own nouns such as agents, chats, sessions, turns, cron, events, memories,
  models, jobs, skills, and tools.
- Grotto avoids leaking runtime-specific product language into its primary UI when a Grotto noun
  already exists.
- Grotto preserves its own distinction between chats, sessions, and turns even if a runtime exposes
  those concepts differently.
- Ownership is per domain.
- Grotto Runtime-owned domains include chats, messages, events, reads, automations, deliveries,
  memory, runtime health, sync state, generated config policy, and jobs.
- Grotto App-owned domains include client cache, app-shell preferences, and presentation overlays.
- Grotto Runtime-owned execution domains include sessions, turns, transcripts, logs, skills,
  tools, model routing, channel bindings, and provider secrets. The local agent engine is an
  implementation detail behind Runtime APIs.

## Runtime Expectations

- Grotto maps runtime data into Grotto product behavior and terminology.
- Grotto App edits runtime-owned config through supported Runtime APIs.
- Grotto does not maintain duplicate canonical records for runtime-owned config.
- Runtime-native edits remain valid and refresh Grotto through sync and events.
- Periodic sync refreshes runtime evidence and observed history. It does not make runtime-native
  config canonical Grotto state.

## Grotto Expectations

- Grotto stays useful when a runtime is offline by rendering existing Grotto records and observed
  history.
- Grotto identifies the runtime source for runtime-backed records.
- Grotto makes sync freshness and failures visible without exposing raw runtime internals.
