# Reminders

Reminders are the only scheduling primitive (D4 in
`specs/raft-alignment/README.md`; the cron/automations product is retired). A
reminder is an author-owned, persistent, observable, snoozable, updatable, and
cancelable wake anchored to a message in a Channel, Thread, or the owning
Agent's DM.

## Hosted model

- The Grotto Server stores reminders, idempotent commands, fire logs, visible
  system receipts, durable change events, and pending Agent attention in
  PostgreSQL. Every relationship carries `server_id`; composite foreign keys
  keep the Agent, anchor Chat, anchor message, receipt, fire, and attention in
  one Server.
- The narrow hosted `agents` and `channel_agent_participants` rows provide only
  reminder authorship and Chat authorization. Agent creation,
  configuration, Computer assignment, execution, and transport are separate
  work.
- Each `reminder_agent_attention` row is one durable, unacknowledged fire
  snapshot. Ordinary attention is removed after a turn that saw the receipt
  completes, or after the turn durably sends output before failing during
  cleanup. Script attention is removed only after the
  assigned Computer returns that fire's idempotent execution result.
- Fresh schema only. Existing Runtime reminder history is not imported or
  adopted, and there is no compatibility path.

## Schedules and authority

- Repeat grammar is exactly `every:<positive>[mhd]`, `daily@HH:MM`, or
  `weekly:<comma-separated days>@HH:MM`. Snooze grammar is
  `<positive>[mhd]`. Wall-clock cadences use the author's home timezone,
  including DST.
- A delayed Server fires one overdue logical slot, then recurring schedules
  advance from the current time. Missed slots never burst.
- An active Agent may schedule, list, inspect logs, snooze, update, or cancel
  only its own reminders and only while it can access the anchor. Owner and
  Admin operators may list all Server reminders, inspect fire logs, and
  cancel. Ordinary Members and cross-Server callers cannot.
- Losing anchor access or retiring an Agent cancels each still-scheduled
  reminder when the scheduler next considers it due. That cancellation removes
  the reminder's unacknowledged attention snapshots; historical fire rows and
  visible receipts remain.
- Commands carry an idempotency key and expected version. A repeated identical
  command returns its original result; reused input conflicts. PostgreSQL row
  locks serialize mutation/fire races. Every reminder write locks its Server
  row before reminder, Chat, message, or event rows so hosted writes share one
  deadlock-free order.

## Fire semantics

The single-node hosted scheduler checks every 15 seconds and once immediately
at startup. A logical fire is unique by reminder and scheduled time. In one
transaction it:

1. appends `🔔 Reminder: <title>` with the explicit reminder system author in
   the anchored Channel, Thread, or owning-Agent DM;
2. records the fire;
3. queues the owning Agent's attention snapshot;
4. advances or completes the reminder; and
5. appends commit-ordered `message.created` and `reminder.changed` events.

This transaction happens while the Agent's Computer may be offline. Every
fire, including a script reminder, has the visible receipt and attention
snapshot.

An optional script is opaque UTF-8 delivery data limited to 16,384 bytes.
The Server stores and snapshots it but never interprets or executes it. When the
assigned Computer is online, the Server sends a typed command containing the
attention and fire ids. When it is offline, the attention stays durable and is
resent on reconnect.

The Computer executes the script once in the owning Agent's workspace with that
Agent's isolated `HOME`, a 60-second timeout, and bounded stdout/stderr. A
restart-durable result marker makes redelivery idempotent. An empty successful
result is recorded without waking the model. Output, timeout, or non-zero exit
appends one canonical reminder system message and wakes the owning Agent. The
fire log stores the bounded output, exit code, and timeout state.

## Surfaces and lifecycle

- The hosted Reminders route is an Owner/Admin operator view backed directly by
  `reminder.list`, `reminder.runs`, and `reminder.cancel`. It keeps script
  contents redacted and recovers changes through durable
  `reminder.changed` cursor catch-up plus live notifications.
- Agent reminder verbs are exposed through the Computer-injected `grotto`
  CLI. Computer reconnect recovery, local script execution, and attention
  acknowledgment are part of the end-to-end contract.
- Scheduler health reports only `healthy`, `degraded`, or `stopped` plus safe
  timestamps. Errors are redacted. One malformed reminder degrades the tick but
  does not block other due reminders. Shutdown stops new ticks and waits for an
  in-flight transaction.
