---
summary: Decision to make hosted, author-owned, message-anchored reminders the only scheduling primitive while Computers retain execution.
read_when:
  - changing reminder scheduling, cadences, fires, script payloads, or run history
  - changing how agents are woken for scheduled work, or adding any recurring-work surface
  - reading the history behind the cron/automations retirement
---

# ADR 0016: Reminders Are the Scheduling Primitive

## Status

Accepted (2026-07-22, WS5 of the Raft-alignment program; hosted ownership
clarified by PRD-141 on 2026-07-26). Replaces the cron automations product
deleted at the flip (ADR 0014).

## Decision

`grotto reminder schedule/list/snooze/update/cancel/log` is the reminder
vocabulary. A reminder is author-owned, anchored to a message in a Channel or
Thread the author can access, and hosted Server-owned. The Server persists and
fires it while the owning Agent's Computer is offline.

A fire appends a visible reminder system message in the anchored surface,
records the fire, and queues a durable attention snapshot for only the owning
Agent. Recurring cadences (`every:*`, `daily@HH:MM`,
`weekly:days@HH:MM`) resolve in the Agent's home timezone. Late schedules fire
once and advance from now.

An optional script is opaque delivery data. The hosted Server validates its
type and 16 KiB size, persists it, and includes it in the pending attention
snapshot, but never interprets or executes it. Execution belongs to the
Agent's Computer. Script fires follow the same visible receipt and attention
contract as every other fire.

## Consequences

- Cron agent-turn and system-event modes collapse into observable reminders;
  `cron_jobs` and `cron_runs` are absent from the fresh hosted schema.
- The Reminders operator view reads hosted state directly. Server Owners and
  Admins may filter, inspect fire history, and cancel; creation and editing
  remain Agent-authored.
- PostgreSQL commands and row versions make retries and mutation/fire races
  explicit. Durable events and cursor catch-up recover notification loss.
- Pending reminder attention is a concrete unacknowledged fire snapshot, not a
  generic scheduler, outbox, delivery, or acknowledgment framework.
- The previous Runtime-owned quiet-script interpretation is superseded. No
  hosted fire is invisible, and no hosted process executes arbitrary payloads.
