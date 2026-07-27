# Tasks

Chat-first tasks implement D8 from `specs/raft-alignment/README.md`. A task is one canonical hosted
message plus Server-owned lifecycle metadata. Its deterministic child Thread is the work surface;
all views are projections, never another conversation or content store.

## Hosted model

`message_tasks` keys metadata by `(server_id, message_id)` and also binds the canonical
`chat_id`: monotonic per-Chat task number, status, optional human assignee and claim time,
priority, origin, creator, and monotonic version. The work-surface Thread id is derived
deterministically from the message id; it is not stored on the task row.

`task_labels` is the small Server task-label catalog; `message_task_labels` links catalog entries
to tasks. Composite foreign keys keep task, message, Chat, assignee, and labels in one
Server tenant. `chat_messages.task` and task-list reads project the same row.

Only top-level Channel or DM messages can be promoted. Promotion is idempotent by canonical
message identity. Atomic create uses the message nonce for replay and creates the message, task,
Thread, and durable events in one transaction.

## Authority and concurrency

- Any authorized parent-Chat participant can create/promote a task and update status, priority,
  or task labels using `expectedVersion`.
- Claim is self-only. The first transaction holding the membership, Chat, and task locks wins;
  a second claimant cannot acquire ownership at the same version.
- Only the current assignee can unclaim.
- Server Owners and Admins can reserve or clear assignment. A human assignee must have active
  Server membership and parent-Chat access.
- Members can create task-label catalog entries. Owners and Admins can rename, recolor, or delete
  catalog entries.
- Revoked Server membership, lost parent-Chat access, cross-Server ids, and stale versions fail
  closed.

Assignee and status are independent. Claiming an unassigned `todo` task moves it to
`in_progress`; unclaiming preserves status. Done tasks cannot be claimed or unclaimed.

## Events and recovery

Task transactions emit small concrete durable events:

- `task.created`: Server, parent Chat, canonical message, sequence, and cursor
- `task.updated`: the same ids for lifecycle changes
- `task.label.updated`: Server, label, and cursor

Events notify; PostgreSQL task/message/label reads remain authoritative. The App uses the same
event targeting for live delivery and cursor catch-up after reconnect.

## Surfaces

- Hosted App: Server Board and List lenses with create, claim, unclaim, human assignment, status,
  priority, and task-label controls. Opening a task opens the canonical message's hosted Thread.
- Managed CLI: `task list|create|claim|unclaim|update` parser/wire/client contract over an injected
  peer. The production CLI does not activate this hosted peer yet. It adds no Agent
  authentication, Server route, Runtime proxy, or execution activation.

The App has no calendar or scheduling fields. The word “calendar” in PRD-140's original acceptance
text is stale relative to ADR 0015, D8, and the accepted WS6 plan; reminder/scheduling work belongs
to PRD-141. Production activation of the managed CLI belongs to PRD-145.

The pre-cutover local Runtime task model and its existing CLI/receipts remain separate until that
activation. Hosted Server tasks add no receipt author and do not import local history.

## Non-goals

No hosted system receipts, Agent assignees, due dates, reminders, attachments, task deletion,
inbox/outbox, auto-dispatch, per-task conversation store, generic workflow engine, or generic
label/taxonomy framework.
