---
summary: Effect supports process lifecycle ownership without becoming a product or domain boundary.
read_when:
  - adding or migrating Effect code
  - changing Server or Computer process runtime ownership
  - adding recurring work, scoped resources, or Effect-to-Promise seams
  - adding telemetry spans, metrics, or trace propagation
---

# ADR 0025: Effect Supports Lifecycle Ownership

## Status

Accepted (2026-08-30).

Implementation status after the 2026-09-02 `origin/main` rebase: the Server
runtime and shared Effect integration package are active. Computer owns one runtime per
attachment daemon, including reconnect backoff, connection schedules, heartbeat
deadlines, per-Agent work coordination across reconnects, Browser supervision,
reminder subprocesses, Harness stream supervision, and sandbox child processes.
Computer also owns a request-local Agent activity run that pairs semantic
operations across success, failure, and interruption and produces the durable
per-turn aggregate used by App analytics.
The current shared cache, bootstrap refresh, and Grotto Agent version flow remain
intact; finite Harness session calls stay at the foreign Promise adapter.

## Decision

Effect is an implementation tool inside Grotto Server and Grotto Computer. It
does not define product packages, wire contracts, or domain ownership.

`@grotto/effect` owns only integration policy shared by both processes:

- the Effect-to-Promise settlement contract;
- process logger configuration;
- OpenTelemetry runtime, privacy, and Promise-boundary policy;
- the virtual-time test runtime.

Grotto Server owns one managed Effect runtime per Server application. Grotto
Computer owns one per attachment daemon. Domain modules receive that runtime
through their existing options-object interfaces. The App, `@grotto/api`, and
other product packages remain Effect-free.

Expected Effect failures cross Promise seams with their identity intact.
Defects and composite causes cross as Effect's native `Runtime.FiberFailure`,
retaining the complete `Cause` at `Runtime.FiberFailureCauseId`. Interruption becomes a value only when the caller explicitly
supplies that policy.

The settlement adapter is not a replacement for Effect's runtime. Native
`runPromise` rejects with `FiberFailure` even for one expected failure. Existing
Promise-facing adapters require the original domain error for classification
and API mapping, so `settle` unwraps only that case. All other failures use
Effect's native representation. Do not introduce a parallel failure class.

Recurring work uses Effect clocks, scopes, and schedules. Existing fixed-rate
timer behavior remains fixed-rate with `Schedule.fixed`; a domain may choose
fixed-delay behavior explicitly when elapsed time should begin after work
finishes. Tests use `TestClock` and must distinguish those semantics when work
duration matters.

Effect log records use the process logger. Recoverable background failures log
an operation name and a safe failure classification, never an arbitrary foreign
error message. The same process runtime exports opt-in OpenTelemetry traces and
low-cardinality metrics. Product modules name operations and supply allowlisted
identifiers; `@grotto/effect` owns redaction, export, shutdown, and W3C trace
propagation. No configured OTLP endpoint means no exporter and no telemetry
network I/O.

## Boundary test

Use Effect when Server or Computer owns concurrent work, recurring work,
cancellation, retry policy, or a resource whose release must survive failure and
interruption. Keep a direct Promise or `try`/`finally` when it is only the narrow
adapter for a foreign API or one finite lexical cleanup. Effect does not improve
a file-handle close merely by wrapping it; it improves the owner coordinating
that close with other work.

The following shapes are therefore valid without an Effect program:

- callback and event adapters required by Bun, Node, WebSocket, or test-support
  APIs;
- request-local `AbortController` bridges passed to foreign clients;
- finite file-handle, temporary-file, SQL-client, and lock release when the
  resource cannot outlive the function;
- post-commit delivery wakes whose durable retry owner is Server recurring
  work.

Each exception still needs explicit failure handling. A swallowed foreign error,
detached Promise, or ambient timer is not justified merely because it sits at an
external boundary.

## Enforcement

`bun run effect:migration-check` scans production Server and Computer source.
During the migration its checked-in ceilings ratchet static `Effect.run*` calls
and custom Cause settlement downward: new debt, growth, and stale ceilings all
fail. The completion check additionally requires both categories to be zero.
The shared `@grotto/effect` boundary is the only place that translates an
Effect `Exit` into a Promise result.

## Consequences

- Domain packages continue to organize around Grotto concepts rather than
  Effect concepts.
- `@grotto/effect` stays a closed integration module, not an Effect utility
  collection. Domain errors, schedules, services, and business logic do not
  belong there.
- Static `Effect.run*` calls are migration debt. Lifecycle-owning modules use
  the Server or attachment-daemon runtime instead.
- If Server and Computer stop sharing these policies, the package should be
  removed and its implementation returned to the remaining owner.
