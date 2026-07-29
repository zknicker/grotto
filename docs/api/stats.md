---
summary: Stats API for usage summaries, spend estimates, model/provider activity, runtime health, and source-backed operational signals.
read_when:
  - changing usage, spend, runtime health, or operational stats APIs
  - changing how clients read provider activity or cost signals
---

# Stats API

The Stats API is for usage, spend, runtime health, and operational signal.

Stats are derived from durable records and provider/runtime activity. They do
not require clients to parse logs or runtime internals.

## Contract

* Usage records keep stable timestamps, provider/model identity, and source
  attribution.
* Cost signals are explicit about provider, currency, and estimate status.
* Runtime health is a freshness signal, not a gate for reading durable app data.
* Aggregates point back to source records when useful.
* Realtime events can refresh stats, but reads are the source of truth.
* Hosted usage is stored as the latest source-attributed snapshot per Computer.
  Members can read those snapshots while a Computer is offline.

## Surface

The API covers:

* read Codex and OpenRouter usage summaries
* read provider and model activity
* read spend estimates
* read runtime health
* read slow, failed, or expensive work signals

## Runtime Boundary

Computers and providers produce raw activity. The hosted Server persists
sanitized per-Computer snapshots and turns them into app-visible usage, spend,
freshness, and health views.

## Related Docs

* [Stats feature](../features/stats.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
