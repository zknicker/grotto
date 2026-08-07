# Agent Runtime

Grotto Runtime manages one local agent runtime namespace and presents execution
state through Grotto primitives.

## Model

- Grotto Runtime owns local agent execution.
- Grotto Runtime owns canonical chats, messages, events, reads, automations,
  deliveries, Memory, generated instruction inputs, sync status, and
  Runtime-specific metadata.
- Grotto Runtime owns provider catalog entries, enabled providers, provider
  access, executable model inventory, selected model, executable settings,
  sessions, turns, tool calls, and response activity.
- AI SDK harness adapters own model calls. Codex and Claude use local
  OAuth-backed CLI providers; OpenAI and OpenAI-compatible models use the Pi
  harness with API-key credentials.
- Grotto App owns client cache, presentation state, and app-shell preferences.
- Grotto does not require users to configure the internal engine dependency
  through native files or CLIs.

## Runtime Identity

- Grotto has one managed runtime namespace: `tavern-agent-engine`.
- The namespace is stable across Runtime restarts and runtime-state resets.
- Synced runtime tables may keep a `runtime_id` column for scoping and forward
  compatibility, but product behavior must treat it as the stable agent runtime
  namespace, not as a selectable runtime list.
- The Grotto Runtime endpoint can be offline while previously synced records
  remain visible.

## Synced Records

- Grotto stores local records for Runtime primitives.
- Synced rows use stable Runtime identifiers and the stable
  `tavern-agent-engine` namespace.
- Synced rows include `last_synced_at`.
- On boot, reconnect, scheduled sync, and runtime events, Grotto refreshes
  affected records.

## Edits

- Editing agent settings in Grotto calls Runtime APIs and updates Runtime-owned
  executable settings state.
- Runtime applies supported settings to the local turn runner.
- Unsupported execution knobs are not exposed as settings.
- Runtime-originated events notify Grotto through targeted sync.
- Grotto-owned fields on local records, such as visual color, remain local
  Grotto state.
