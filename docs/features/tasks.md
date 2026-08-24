---
summary: Hosted chat-first tasks — canonical messages with Server-owned lifecycle metadata, Thread work surfaces, and board/list lenses.
read_when:
  - changing task promotion, claiming, assignment, statuses, priorities, or labels
  - changing hosted task authorization, events, or Thread work surfaces
  - changing the Server UI task board/list or managed task CLI contract
---

# Tasks

A task is a canonical hosted Chat message promoted with task metadata. The message body is the
task title verbatim, its existing child Thread is the work surface, and board/list views are
lenses over the same message. Grotto does not keep a second task conversation or content store.

## Lifecycle

- A human can atomically create a message as a task or idempotently promote an existing top-level
  Channel or DM message.
- Each parent Chat allocates monotonic task numbers while its Chat row is locked.
- Status is `todo`, `in_progress`, `in_review`, `done`, or reversible `closed`.
- Priority is `none`, `urgent`, `high`, `medium`, or `low`.
- Labels come from one small Server task-label catalog. Members can create labels; Owners and
  Admins can rename, recolor, or delete them.
- Claiming is one concurrency lock across human and Agent actors. The first valid claim owns the
  task and advances its version; competing claims at the same version fail without double
  ownership.
- Owners and Admins can reserve a task for any active participant of the parent Chat — an Agent or
  a human. Assigning an Agent wakes it with a private assignment receipt; assignment reserves and
  never claims, so the assignee still claims the task before starting. Agents can reserve a newly
  created Channel task for another active Agent in that Channel.
  Only the current assignee can unclaim.
- Assignment and status are independent: reserving a task never moves it along the lifecycle.
  Reassigning releases the previous claim, so the new assignee claims before starting.
- Done and closed tasks cannot be claimed, unclaimed, or assigned.

Creating or promoting a task updates the canonical message projection and emits task events. It
does not append a user-visible state-change receipt to the parent Chat. When an Agent directly
assigns a newly created task to another Agent, Server also creates a private assignment system
message for that assignee's inbox; the App filters it from the Chat transcript and human unread
counts. The canonical task message remains the only task record.

Every lifecycle mutation after creation carries `expectedVersion`. Stale assignment or metadata
writes fail and the Server UI waits for Server state rather than inventing durable optimistic task
records.

## Work surface and authorization

Promotion creates or resolves the deterministic hosted child Thread anchored to the canonical
message. Opening a task opens that Thread. The Thread has no independent membership: Server
membership and parent-Chat participation remain the sole access authority.

Agents use the Task Thread for progress and execution discussion. They deliver the final result
there unless a human names another final-delivery target. That exception applies only to the final
result, which is delivered once to the exact requested target. `Here` always means the human
instruction message's target, never the Task Thread the Agent moved into.

Task lists, eligible assignees, messages with task projections, task events, and Thread reads all
apply the same hosted Server and parent-Chat authorization. Revoked members and humans who lose
parent-Chat access cannot continue reading or mutating the task.
Removing a human member or retiring an Agent releases their claims and assignments. Reinvitation
or reactivation does not restore those links or access to task Threads from the former membership
stint.

## Server UI and realtime

The hosted `/s/<slug>` Server UI provides List and Board lenses; the Linear-style List is the
default. List rows are dense and display-only — priority glyph, task number, status disc, title,
labels, origin Chat, updated time, and assignee avatar — while create, claim, unclaim, assignment,
status, priority, and task-label controls live on the Board cards and the Task Thread. Both lenses
order each status group by priority, urgent first. Loading, empty, filtered-empty, and
authorization failures are explicit. The Tasks topbar owns the chat-scope filter, layout, and creation controls —
`?chat=<chatId>` carries the scope, and each chat's name menu deep-links here
pre-scoped; Server-wide
search opens from the contextual sidebar and finds tasks through their canonical Chat messages;
the ordinary Chat composer sends messages only, while existing top-level messages can be promoted;
the contextual sidebar owns saved views and label filters. Opening a task from either lens shows
its Thread work surface in a dialog over the tasks page — `?task=<messageId>` owns the open task,
so deep links and Back work — while "View in channel" and artifact opens navigate to the parent
Chat. Inside a Chat, opening a task still uses the chat-owned Thread side pane. A Task Thread shows the task number, current status, assignee, and creator beneath its
anchor message. Status is editable there; Owners and Admins can also change or clear the human
assignee. Both controls mutate the same authoritative task record used by Board and List views.

Concrete durable events (`message.created` for a newly composed task, `task.created`, `task.updated`, and
`task.label.updated`) notify the Grotto App. The hosted realtime hook owns exact task-list, label-catalog,
and affected-message invalidation; cursor catch-up applies the same invalidations after reconnect.

In Chat, task metadata is compact and neutral: the task number owns the work-surface left edge,
only the trailing status disc carries lifecycle color, and an assignee appears by avatar and display
name. Every openable task uses the same recessed Thread surface; tasks with replies add the reply
count and previews, while tasks without replies retain the same header padding and click target.

There is no task calendar, due date, or `scheduledFor` field. Scheduling belongs to reminders, not
tasks.

## Managed CLI boundary

The managed `grotto task list|create|claim|unclaim|update` commands use the
Computer's loopback runner authority and the hosted Server task API. Agent
identity comes only from the scoped runner credential. A human-composed task
enters the same durable inbox and wake path as its canonical Chat message;
structured task metadata rides the drain, read, check, and search projections.
An unassigned task remains `todo` until an Agent deliberately claims it.
An Agent-created peer assignment follows the task Thread for the assignee and enters the same
durable delivery path as direct attention. It wakes only that Agent; it does not unmute the
Channel or wake unrelated muted members. Task creation carries an idempotency nonce so retries
cannot create duplicate task messages.

## Coordination handoffs

When a user gives an explicit cutoff for independent task lanes, the coordinating Agent works to
that cutoff instead of waiting indefinitely for every assignee. It delivers the useful result
available so far, identifies which inputs arrived and which remain pending, and treats silence as
unknown. A missing reply is not approval, negative evidence, or completed work.

## Deliberate exclusions

Also excluded: task scheduling, attachments, deletion, dependencies, epics, generic
workflow machinery, and generic taxonomy infrastructure.
