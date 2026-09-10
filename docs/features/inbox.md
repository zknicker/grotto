---
summary: The human Inbox page — a sidebar lens over Asks, Tasks, live Agent work, and unread conversation.
read_when:
  - changing the Inbox page, its sections, empty states, or realtime invalidation
  - adding a record that should ask a human to act or should stay observable between turns
  - deciding where background work that outlives an Agent turn becomes visible to humans
---

# Inbox

The Inbox is a Grotto App page in the sidebar. Its row is the sidebar's anchor — first in the
Inbox/Search/Tasks menu, wearing the Grotto ghost mark, which turns iridescent while any Agent is
working. The row badges the **Needs you** total in the same count chip the Channel and DM rows wear
for unread messages, and shows nothing when nothing needs you. It shows one human what they need to
know right now.

The Inbox is a lens, not a store. It owns no state of its own, creates no records, and duplicates no
lifecycle. Every row projects an existing Server record and links to that record's canonical place —
a Chat, a Thread, or an Agent profile.

The agent-side concept with a similar name is the [Agent inbox](../../specs/inbox.md), the durable
delivery ledger that wakes Agents. Say "Agent inbox" wherever the two could be confused.

## Sections

The page has three sections in this order.

**Needs you** — work waiting on this human:

- Open [Asks](../../specs/asks.md) addressed to me, with the recommended step as a button.
- Claims an Agent took and stopped short of finishing.
- [Tasks](tasks.md) in `in_review` that I created or that are reserved for me.

**Happening now** — work running right now, whether or not this human started it:

- Agents currently in a turn, from the same data as the Agent activity strip
  ([Agent Activity](../../specs/agent-activity.md)).
- [Cloud Agent work](../../specs/cloud-agents.md) queued or running anywhere on the Server I can
  see, with its title and elapsed time.

This is where background work that outlives an Agent turn stays observable.

**While you were away** — unread Chats and followed Threads with their unread counts and last line,
read from the existing read state.

## Current stub

The page is live at `/s/:slug/inbox` with all three sections and their empty states. **Needs you**
leads with open [Asks](../../specs/asks.md) addressed to the viewer — title, summary, Chat and
asking Agent, and the recommended step as a button that sends that exact text into the Ask's Thread
as the viewer's own Message — then the claims an Agent stopped before finishing, then Tasks in
`in_review` that the viewer created or that are reserved for them. An Ask row peeks its Thread over
the Inbox at `?ask=<messageId>`; a Task row opens the Task on the Tasks page.

A **stalled claim** row is where a person learns that an Agent took work and dropped it, because
[Chat hides an Agent's own claims by default](tasks.md). It is composed from the same `task.list`
read the section already makes — a task with `origin` `claimed`, status `in_progress`, tier
`tracked`, and `live` false, meaning its run settled without answering and no reply is coming — and
reads as the Agent's avatar, `Blippy stopped before finishing`, what was asked, and the Chat and
task number. It opens the task the way the review rows do, and refreshes on the `task.updated`
invalidation those rows already ride.

**Happening now** leads with queued and running
[Cloud Agent work](../../specs/cloud-agents.md) — cloud glyph, title, status with elapsed time,
Chat, and the delegating Agent — above the Agents currently in a turn, read from the Agent activity
provider. A work row peeks its conversation over the Inbox at `?work=<messageId>` — the same Thread
timeline the Chat opens, work card and all; an Agent row opens that Agent's page in Settings. The section stays neutral until both reads settle, and states
one empty line when neither has anything to show. **While you were away** lists Chats with an unread
count, newest activity first, and opens the Chat.

One source has no Server list procedure yet and is absent until it does: followed Threads plus each
Chat's last line (**While you were away**).

## Rules

- Each section states its own explicit empty state. A quiet section says so; it does not collapse
  into the section above it.
- The page updates from the durable events the underlying records already emit — `ask.updated`,
  `task.updated`, `cloud-agent-work.updated`, Agent activity, and `message.created` — through the
  existing invalidations. The Inbox adds no event of its own.
- The Inbox owns no read state. Unread counts come from `chat_reads`; open and answered come from
  the Ask, Task, and work records. Opening the Inbox marks nothing read.
- The Inbox adds no store, no cache, and no page-local lifecycle. Authorization is the ordinary
  Server membership and Chat access of each projected record.
- iOS mirrors this page later; the sections and their ordering are the contract it mirrors. No iOS
  Inbox exists yet, and Cloud Agent work has no iPhone presentation either.
