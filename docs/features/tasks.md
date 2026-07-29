---
summary: Hosted chat-first tasks — canonical messages with Server-owned lifecycle metadata, Thread work surfaces, and board/list lenses.
read_when:
  - changing task promotion, claiming, assignment, statuses, priorities, or labels
  - changing hosted task authorization, events, or Thread work surfaces
  - changing the App task board/list or managed task CLI contract
---

# Tasks

A task is a canonical hosted Chat message promoted with task metadata. The message body is the
task title verbatim, its existing child Thread is the work surface, and board/list views are
lenses over the same message. Tavern does not keep a second task conversation or content store.

## Lifecycle

- A human can atomically create a message as a task or idempotently promote an existing top-level
  Channel or DM message.
- Each parent Chat allocates monotonic task numbers while its Chat row is locked.
- Status is `todo`, `in_progress`, `in_review`, `done`, or reversible `closed`.
- Priority is `none`, `urgent`, `high`, `medium`, or `low`.
- Labels come from one small Server task-label catalog. Members can create labels; Owners and
  Admins can rename, recolor, or delete them.
- Claiming is the concurrency lock. The first valid claim owns the task and advances its version;
  competing claims at the same version fail without double ownership.
- Owners and Admins can reserve a task for an active human Server member who can open the parent
  Chat. Only the current assignee can unclaim.
- Done tasks cannot be claimed or unclaimed.

Every lifecycle mutation after creation carries `expectedVersion`. Stale assignment or metadata
writes fail and the App waits for Server state rather than inventing durable optimistic task
records.

## Work surface and authorization

Promotion creates or resolves the deterministic hosted child Thread anchored to the canonical
message. Opening a task opens that Thread. The Thread has no independent membership: Server
membership and parent-Chat participation remain the sole access authority.

Task lists, eligible assignees, messages with task projections, task events, and Thread reads all
apply the same hosted Server and parent-Chat authorization. Revoked members and humans who lose
parent-Chat access cannot continue reading or mutating the task.
Removing a member releases their claims and assignments. Reinvitation does not restore those
links or access to task Threads from the former membership stint.

## App and realtime

The hosted `/s/<slug>` App surface provides Board and List lenses with create, claim, unclaim,
assignment, status, priority, and task-label controls. Loading, empty, filtered-empty, and
authorization failures are explicit. Opening a row returns to its message and Thread.

Concrete durable events (`task.created`, `task.updated`, and `task.label.updated`) notify the App.
The hosted realtime hook owns exact task-list, label-catalog, and affected-message invalidation;
cursor catch-up applies the same invalidations after reconnect.

There is no task calendar, due date, or `scheduledFor` field. Scheduling belongs to reminders, not
tasks.

## Managed CLI boundary

The managed `grotto task list|create|claim|unclaim|update` commands use the
Computer's loopback runner authority and the hosted Server task API. Agent
identity comes only from the scoped runner credential. A human-composed task
enters the same durable inbox and wake path as its canonical Chat message;
structured task metadata rides the drain, read, check, and search projections.
An unassigned task remains `todo` until an Agent deliberately claims it.

## Deliberate exclusions

Hosted tasks do not emit system receipt messages. State is visible through the task row, its
durable task events, and its Thread. Also excluded: task scheduling, attachments, deletion,
dependencies, epics, generic workflow machinery, and generic taxonomy infrastructure.
