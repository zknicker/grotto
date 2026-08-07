# Communication Regression

Grotto verifies runtime communication with deterministic scenarios that exercise chat sends,
session history sync, runtime events, reconnects, timeouts, and cron run pagination. These tests
protect Grotto's sync-first model from duplicate messages, lost messages, stale overwrites, and
event-loop regressions.

The regression suite uses a contract-shaped mock agent runtime. It does not
require real model providers and does not add mock-only product APIs to Grotto.

## Goals

- Prove durable runtime-backed records are idempotent under duplicate and out-of-order runtime events.
- Prove runtime history remains authoritative over volatile event payloads.
- Detect message loss, duplicate messages, ordering violations, timeout loops, and overlapping sync
  races.
- Verify cron run pagination and failure classification.
- Produce CI reports that identify the scenario and metric that failed.

## Non-Goals

- The suite does not replace mapper tests with sanitized agent-engine payloads.
- The suite does not test agent-engine process management or local gateway startup.
- The suite does not require a bundled agent engine.
- The suite does not depend on screenshots for low-level communication metrics.

## Test Boundary

The website e2e harness runs the real Grotto website and server with a deterministic mock agent
runtime.

Allowed flow:

```txt
Website UI or tRPC client
  -> Grotto server
  -> Grotto API client
  -> mock agent runtime
  -> Grotto sync paths and event handlers
  -> local records
```

The mock runtime exposes normal runtime contract routes for agents, chats, sessions, messages, cron,
skills, models, status, and events. Test-only admin endpoints may reset scenarios and read metrics,
but they must not create product records through non-contract shortcuts.

## Metrics

Each scenario records a metrics object.

- `message_loss_count`: expected durable messages that never appear.
- `duplicate_message_count`: durable messages with duplicated stable runtime ids.
- `message_order_violation_count`: durable history sorted differently from runtime authority.
- `duplicate_event_rate`: duplicate runtime events divided by total runtime events.
- `event_to_sync_latency_ms`: time from runtime event to corresponding record update.
- `history_refetch_count`: number of history reads triggered for the scenario.
- `history_overlap_count`: number of concurrent history syncs for the same session.
- `inflight_sync_max`: maximum concurrent syncs per primitive/session.
- `runtime_request_timeout_rate`: timed-out runtime requests divided by total runtime requests.
- `stale_status_duration_ms`: time that active runtime status remains stale after authoritative
  history has settled.
- `cron_run_pagination_gap_count`: missing, repeated, or skipped cron run pages.

CI thresholds should be strict for correctness metrics and tolerant for timing metrics. Any message
loss, duplicate durable message, order violation, or cron pagination gap is a failure.

## Required Scenarios

### Happy-Path Chat

A user sends a message. The runtime accepts it, emits turn/session events, exposes user and
assistant messages through history, and Grotto renders each durable row once.

Expected:

- accepted send returns a run id, presence id, and session binding id
- synced history includes user and assistant messages
- no duplicate durable messages
- active status clears when authoritative history completes

### Duplicate Runtime Events

The runtime emits the same `session.message`, `sessions.changed`, or equivalent invalidation event
multiple times.

Expected:

- Grotto may debounce or repeat sync
- durable history contains each runtime message once
- duplicate events do not create duplicate rows or permanent active status

### Out-of-Order Events

The runtime emits completion before one message event, or a tool event before the assistant message.

Expected:

- event payload order does not define durable transcript order
- authoritative history sync produces correctly ordered rows
- stale volatile state clears after history settles

### History Overlap

Two history syncs for the same session overlap and return in reverse order.

Expected:

- older/slower sync results do not erase newer rows
- bounded message sync does not delete rows outside its authoritative window
- `history_overlap_count` is either prevented or tolerated without data loss

### Runtime Reconnect During Turn

The event stream disconnects while a turn is active, reconnects, and emits an invalidation.

Expected:

- synced records stay visible while disconnected
- reconnect triggers focused sync
- final history is recovered without duplicate messages
- connection status updates without full-page loading gates

### Accepted Send, Delayed History

The runtime accepts a user message immediately, but `chat.history` does not include the message or
assistant reply for a short period.

Expected:

- optimistic user row remains app-local
- durable history is not patched to include optimistic rows
- logged history eventually replaces the local optimistic row
- no immediate durable refetch loop is required just to show the optimistic row

### Send Timeout With Runtime Completion

The send request times out or the connection drops after the runtime accepted the run. The runtime
later exposes the completed session through history.

Expected:

- Grotto reports the timeout without creating fake durable messages
- later event or sync discovers the completed history
- user and assistant messages appear once after recovery

### Cron Run Pagination

`cron.runs` returns multiple pages. Variants include normal pagination, empty final page, repeated
offset, missing `nextOffset`, and partial page failure.

Expected:

- normal pagination imports all runs once
- repeated offsets or missing `nextOffset` fail as `apiServer` degradation with cron-run context
- cron job config remains available when only run history fails

### Partial Session History Failure

`sessions.list` succeeds, but one `chat.history` request fails.

Expected:

- other sessions continue syncing
- failed session history remains unchanged
- failure is attributed to `apiServer` or the concrete session history sync

### Runtime Status Flap

Runtime health alternates between reachable and unreachable while records already exist.

Expected:

- synced data remains visible
- connection state updates
- background refresh does not replace pages with blocking runtime loading states

## Implementation Shape

- Scenario controls live in the website e2e mock runtime.
- Metrics collection lives in the mock runtime, server test helpers, or a small comms runner.
- Reports are written as machine-readable JSON plus a human-readable Markdown summary.
- The runner can execute in CI without real model-provider access.
- Scenario setup should prefer normal runtime contract routes over admin shortcuts.
- Admin endpoints are limited to reset, scenario mode, event injection, and metrics reads.

## Report Shape

Each report includes:

- generated timestamp
- git revision when available
- scenario result table
- metric table with thresholds
- failing scenario details
- runtime events emitted
- sync requests observed
- final record counts

## Acceptance Criteria

- The suite runs deterministically in CI.
- A failure identifies the scenario, metric, observed value, and threshold.
- Duplicate/out-of-order events do not duplicate durable messages.
- Overlapping history syncs do not erase newer history.
- Reconnect and timeout scenarios recover from authoritative history.
- Broken cron run pagination is detected and classified without blocking cron job config.
