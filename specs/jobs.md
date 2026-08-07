# Jobs

Jobs are Grotto's internal scheduled and on-demand background work.

## Product Expectations

- Jobs are Grotto-owned operational primitives.
- A job should make it easy to understand what Grotto is doing in the background and whether it is
  healthy.
- The jobs surface should help a person inspect recent runs, failures, and timing without reading
  logs first.

## Scope

- Jobs cover Grotto's own background work such as sync, ingest, refresh, and reconciliation tasks.
- Jobs are not the same thing as agent workers or runtime tasks.

## Runs And Status

- A job may run many times over its lifetime.
- Recent runs should remain inspectable with timing, outcome, and useful failure detail.
- A person should be able to tell whether a job is enabled, idle, running, failing, or blocked by
  missing configuration.
