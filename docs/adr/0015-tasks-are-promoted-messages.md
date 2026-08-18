---
summary: Decision to model tasks as chat messages promoted with task metadata, with claim-before-work as the concurrency lock and board/priority/labels as lenses.
read_when:
  - changing task storage, numbering, claiming, statuses, receipts, or the task CLI
  - changing the Tasks views, task creation, task chips, or Convert to Task
  - considering a separate work tracker, dispatch queue, or task scheduling
---

# ADR 0015: Tasks Are Promoted Messages

## Status

Accepted (2026-07-22, WS5 of the Raft-alignment program; decision D8 in
`specs/raft-alignment/README.md`, ruled 2026-07-20/21). Supersedes the retired
pre-flip tracker (tasks/epics/T-numbers/dispatch).

## Decision

A task is a chat message promoted with task metadata stored in a
`message_tasks` row keyed by the message id: a per-conversation number,
status (`todo → in_progress → in_review → done`, reversible `closed`),
assignee + claim timestamp, priority, and label references. The message body
is the task title, verbatim. The message's thread is the work surface.
Claim-before-work is one human-or-Agent concurrency lock: a claim held by
someone else fails closed. Board, list, priority, label, and filter views are
lenses over task-messages — never a second store. Task state changes do not
create receipt messages.

Peer-Agent assignment is the one private handoff exception: the canonical task
message remains the durable Chat work item, and the assigned Agent also
receives a Server-authored task assignment system message through its inbox.
The assignment receipt is not part of the App Chat transcript or human unread
count.

## Consequences

- Nothing schedules tasks. Agents normally pull and claim work, while direct
  peer assignment of a newly created task wakes only the assigned Agent through
  the ordinary durable delivery path. The assigned Agent receives both the
  canonical task envelope and a private assignment receipt; the receipt is a
  handoff cue, not a second task record. A dated follow-up is a reminder
  anchored on the task message (ADR 0016), so `scheduledFor` and the calendar
  lens died.
- Epics, dependency edges, per-task work chats, attachment promotion, and the
  `tasks_*` engine tools all retired with the old tracker.
- Thread and system messages cannot become tasks; task numbers are
  per-conversation and rendered `task #N`.
- The ordinary Chat composer sends messages only. Humans create tasks from the
  Tasks surface or promote an existing top-level message with Convert to Task.
- The old `tasks`/`task_*` tables and their repair/migration machinery were
  deleted from the fresh schema; live databases drop the orphaned tables at
  the WS5 manual cutover.
