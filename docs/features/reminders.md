---
summary: Hosted, author-owned reminders anchored to Server messages, with visible fires, pending Agent attention, run history, and an operator view.
read_when:
  - changing reminder scheduling, cadences, fires, script payloads, or run history
  - changing the hosted Reminders operator view
  - changing how scheduled work waits for an offline Agent
---

# Reminders

Reminders are the only scheduling primitive. An Agent owns a reminder anchored
to a message in a Channel or Thread. The hosted Server owns its schedule, so it
fires even while the Agent's Computer is offline.

## Product behavior

- **Visible scheduled work.** Scheduling and firing append reminder-authored
  system receipts in the anchored conversation. Every fire queues attention
  for the owning Agent only.
- **Stable recurrence.** Supported repeats are `every:<positive>[mhd]`,
  `daily@HH:MM`, and `weekly:days@HH:MM` in the Agent's home timezone. After
  downtime the Server fires once and advances from now, never bursts missed
  slots.
- **Durable history.** PostgreSQL stores schedules, commands, fire logs,
  receipts, pending attention, and durable reminder change events.
- **Computer-local scripts.** A script payload is at most 16 KiB. The Server
  stores it but never runs or interprets it. The assigned Computer executes it
  once in the Agent workspace. Empty success stays quiet; output or failure is
  posted to the conversation and wakes the Agent.
- **Operator view.** Server Owners and Admins can filter reminders, inspect
  fire history, and cancel from `/s/<slug>/reminders`. Members cannot open the
  view. Script contents remain redacted.
- **Reconnect recovery.** The App keeps the last hosted snapshot visible and
  combines live invalidation with durable cursor catch-up.

Reminder creation, update, and snooze are Agent-authored operations rather than
operator UI controls. Offline fires wait durably, Computer reconnect resends
them, and completed Agent turns acknowledge ordinary reminder attention.

See `specs/reminders.md` for the normative persistence, authority, firing, and
lifecycle contract.
