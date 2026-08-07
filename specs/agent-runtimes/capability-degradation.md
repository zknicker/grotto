# Capability Degradation

Grotto treats runtime connectivity and runtime capability health as separate facts. A runtime can
be reachable while one capability is degraded, unavailable, unauthorized, or returning invalid data.
Grotto keeps synced records visible and attributes failures to the narrowest affected
capability.

This spec models capability failures through Grotto Runtime.

## Workstream

This is the first runtime reliability workstream. It should land before communication regression
testing because the regression suite needs stable degradation states to assert failures such as
`apiServer` degraded, `gateway` unavailable, `models` unavailable, or `skills` unauthorized.

This work is a repeatable pattern across runtime-owned primitives and capability surfaces. The
implementation should establish the pattern once, then apply it capability by capability. Do not
build one-off status handling for each page.

## Goals

- Keep dashboard pages usable when the agent engine is partially broken.
- Report which runtime capability failed instead of marking the whole runtime offline.
- Preserve existing records when a sync path fails.
- Make diagnostics and CI failures explain the affected runtime surface.
- Avoid inventing missing runtime ids, timestamps, schedules, actors, or records.

## Implementation Scope

The full implementation has three parts:

- a common capability status contract
- Runtime checks that record status for every capability Grotto depends on
- diagnostics and product reads that reference the stored status without blocking synced data

The first slice should still be small enough to land safely, but it should use the same Runtime
contracts, helpers, and API shape that the full implementation uses. A narrow slice is only a
delivery strategy, not a different design.

The agent-engine slice is `dashboardServer`, `apiServer`, `gateway`, `models`, and `skills`
because those surfaces prove the important agent-engine cases:

- dashboard process reachability through `/api/status`
- authenticated REST API reachability through `/api/sessions`
- Gateway event/send reachability through `/api/ws`
- model inventory through `/api/model/options`
- skill inventory through `/api/skills`

Grotto CRUD, synced chat records, cron records, mentions, and logs are not capability ids unless
they depend on a distinct Runtime-owned service or agent-engine probe.

## Deferred Scope

These items are intentionally not part of the first slice:

- channel, memory, or agent diagnostic surfaces
- copyable rich diagnostic bundles
- page-specific warning banners
- CI communication regression runner
- pairing UX improvements

## Non-Goals

- Grotto App does not bundle, start, repair, or shell out to the local agent engine.
- Grotto App does not read agent-engine runtime state, logs, or config files directly.
- Grotto does not require every runtime to support every agent-engine capability.
- Grotto does not hide malformed runtime responses behind compatibility fallbacks.

## Capability States

Capability state is reported per managed runtime namespace and per capability.

- `unknown`: Grotto has not checked this capability yet.
- `healthy`: the capability recently completed successfully.
- `degraded`: the capability is reachable but returned partial, malformed, slow, or inconsistent
  results.
- `unavailable`: the runtime does not expose this capability or the method is unsupported.
- `unauthorized`: credentials, pairing, or permissions are insufficient for this capability.

Grotto Runtime itself can be `reachable` while individual capabilities are not `healthy`.

## Capability Records

Each capability record includes:

- `capability`: stable capability id.
- `state`: one capability state.
- `checkedAt`: when Grotto last checked or observed this capability.
- `lastHealthyAt`: when the capability last completed successfully, or `null`.
- `reason`: short user-safe reason.
- `method`: runtime method or event stream that produced the state, when known.
- `errorCode`: stable adapter error code, when available.
- `technicalMessage`: concise technical message for diagnostics.

The app may show `reason`. Diagnostic copy/export may include `technicalMessage`.

## Agent Engine Capabilities

Runtime reports capability state for these surfaces:

| Capability | Runtime surface | Primary Grotto impact |
| --- | --- | --- |
| `dashboardServer` | status route | agent process visibility |
| `apiServer` | session routes | authenticated Runtime calls and sync |
| `gateway` | event stream | Grotto chat sends and live agent events |
| `models` | `GET /api/model/options` | model inventory |
| `skills` | `GET /api/skills` | skill inventory |

Future `channels` capabilities may be added when Runtime exposes stable
surfaces that Grotto can consume without local filesystem access.

The Runtime also reports Memory and model-access capabilities that are
independent of agent-engine process reachability: `codexOAuth` and
`memory`.

## Adapter Behavior

Runtime owns raw runtime error classification.

- Unsupported RPC methods map to `unavailable`.
- Auth, pairing, token, or permission failures map to `unauthorized`.
- Timeouts, malformed payloads, pagination defects, missing required ids, and invalid timestamps map
  to `degraded`.
- Transport-level failure that prevents even status checks updates Grotto Runtime health and
  may mark checked capabilities `unknown` until retried.
- Mapper failures include the affected capability and method.
- Mapper failures do not return fabricated Grotto records.

Adapter methods should return normal Grotto data on success. Capability state is exposed through a
dedicated status/diagnostic path rather than mixed into every list response.

The adapter should classify failures close to the gateway request or mapper that sees the failure.
It does not own long-term persistence. It returns data or throws typed failures with enough context
for the server to update capability status.

## Runtime And Server Behavior

Grotto Runtime stores capability state alongside Runtime health and primitive sync state.
The app backend reads this state through Runtime `/capabilities`; it does not run checks or store
Runtime capability health locally.

- A failed primitive sync updates that primitive's sync state only and records the narrow capability
  when a Runtime-owned dependency caused the failure.
- A failed `apiServer` sync does not delete previously synced sessions, messages, or cron records.
- A failed `skills` read does not block already-synced agents, chats, or cron records from rendering.
- Runtime edits still fail loudly when the capability needed for the edit is unavailable.
- Product reads continue to return existing records with freshness and error metadata.

## Runtime Storage

Grotto Runtime stores current capability status in a dedicated table instead of overloading
runtime-backed tables or `sync_state`.

Current related tables:

- `agent_runtime_connections` stores the Grotto Runtime endpoint plus coarse health fields such as
  `last_checked_at`, `last_error`, and `last_synced_at`.
- `sync_state` stores primitive sync freshness keyed by `kind` and `id`. It answers questions such
  as "did agent sync for this runtime succeed?" not "is model execution ready?"
- Runtime-backed tables such as `agents`, `chats`, `session_runs`, `session_messages`, `cron_jobs`, and
  `cron_runs` store runtime-owned records and row-level sync timestamps.

Runtime owns a table shaped like `runtime_capabilities`:

| Column | Purpose |
| --- | --- |
| `capability` | stable capability id such as `apiServer`, `gateway`, or `skills` |
| `state` | `unknown`, `healthy`, `degraded`, `unavailable`, or `unauthorized` |
| `checked_at` | latest check or observed failure time |
| `last_healthy_at` | latest successful check time |
| `reason` | short user-safe reason |
| `technical_message` | concise diagnostic message |
| `metadata_json` | optional structured diagnostic details |
| `updated_at` | row update timestamp |

Use `capability` as the primary key within the Runtime database. The table stores current status,
not an event log. Historical debugging uses Runtime job runs, server logs, or a later status
history table if needed.

Runtime diagnostics compose:

- one `agent_runtime_connections` row for the managed runtime namespace and coarse connection state
- all Runtime `/capabilities` rows for that runtime
- relevant `sync_state` rows for primitive freshness
- runtime-backed records and row `last_synced_at` values for product data

Product reads reference capability status only as context. They still return records first.
Mutations may fail immediately when the required capability is `unavailable` or `unauthorized`, but
list/detail reads should not blank existing synced data because a capability status is unhealthy.

## Event Invalidation

Capability status changes come from Runtime capability events. They do not reuse product data
events.

- Runtime capability changes refresh the runtime settings surface.
- Product data changes emit the owning domain event, such as `skill.onUpdate`, `agent.onUpdate`, or
  `cron.onUpdate`.

The runtime capability event must not invalidate product reads such as `skill.list`. A successful
capability check may happen while serving that same product read, so using the capability event to
refresh product data can create fetch loops.

## UI Behavior

The dashboard shows synced data first and capability degradation second.

- Runtime settings can show a capability table or diagnostic card.
- Product pages can show scoped warnings, such as "Cron run history is degraded."
- Empty runtime results remain valid empty states.
- Runtime-wide loading gates are not introduced for partial capability failures.
- Copyable diagnostics include runtime health, capability states, sync state, and recent
  adapter errors.

The first slice can use minimal visibility in runtime settings or diagnostics to prove the data
path. A polished dashboard view belongs to a later diagnostics workstream.

## Implementation Order

1. Define the capability ids, states, and record shape in the Runtime contract.
2. Add the Runtime `runtime_capabilities` table and storage helpers.
3. Add Runtime capability checks that convert dependency failures into typed capability failures.
4. Expose the stored state through Runtime `/capabilities`.
5. Wire the agent-engine slice: `dashboardServer`, `apiServer`, `gateway`, `models`, and `skills`.
6. Add Runtime, server client, and app rendering tests for the first slice.
7. Repeat the same pattern across the remaining capability table.
8. Add minimal app visibility only if the API path cannot otherwise be verified.

## Tests

Adapter tests cover:

- unsupported method -> `unavailable`
- auth or pairing failure -> `unauthorized`
- malformed list payload -> `degraded`
- missing required id/timestamp/schedule -> mapper failure with capability attribution
- authenticated REST failures -> `apiServer` degradation
- WebSocket open failures -> `gateway` degradation

Server tests cover:

- one primitive sync failure does not poison unrelated primitives
- existing records remain after failed sync
- per-session message sync failures do not delete other session histories
- capability state is exposed in a stable API shape

Website or e2e tests cover:

- synced data remains visible when one capability degrades
- Grotto Runtime can be reachable while a capability warning is visible
- diagnostics copy includes capability state without exposing secrets

The first-slice test set is smaller:

- `/api/model/options` unsupported -> `models: unavailable`
- `/api/skills` unauthorized -> `skills: unauthorized`
- malformed `/api/skills` payload -> `skills: degraded`
- `/api/sessions` transport failure -> `apiServer: unavailable`
- `/api/ws` open failure -> `gateway: unavailable`
- reachable runtime status with one degraded capability remains runtime `reachable`

## Acceptance Criteria

- Grotto can represent "agent engine reachable, skills unavailable."
- Grotto can represent "agent engine reachable, API unavailable, event stream unavailable."
- Malformed agent-engine payloads fail narrowly and do not create fake records.
- Runtime connection status, primitive sync state, and capability state are distinct.
- The diagnostics surface has enough structured data to explain which capability failed and why.

First-slice acceptance is narrower:

- `dashboardServer`, `apiServer`, `gateway`, `modelExecution`, and `skills` expose capability state.
- Unsupported, unauthorized, malformed, and timeout-like failures classify deterministically.
- The server can return a reachable runtime with a degraded or unavailable first-slice capability.
- Existing records are not deleted because a first-slice capability check fails.
