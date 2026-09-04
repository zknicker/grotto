---
summary: The human Inbox page — a sidebar lens over Asks, proposals, Tasks, live Agent work, and unread conversation.
read_when:
  - changing the Inbox page, its sections, empty states, or realtime invalidation
  - adding a record that should ask a human to act or should stay observable between turns
  - deciding where background work that outlives an Agent turn becomes visible to humans
---

# Inbox

The Inbox is a Grotto App page in the sidebar, directly below Search. It shows one human what they
need to know right now.

The Inbox is a lens, not a store. It owns no state of its own, creates no records, and duplicates no
lifecycle. Every row projects an existing Server record and links to that record's canonical place —
a Chat, a Thread, or an Agent profile.

The agent-side concept with a similar name is the [Agent inbox](../../specs/inbox.md), the durable
delivery ledger that wakes Agents. Say "Agent inbox" wherever the two could be confused.

## Sections

The page has three sections in this order.

**Needs you** — work waiting on this human:

- Open [Asks](../../specs/asks.md) addressed to me, with the recommended step as a button.
- Pending Agent creation proposals I can commit. Owners and Admins only.
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
as the viewer's own Message — then lists Tasks in `in_review` that the viewer created or that are
reserved for them. An Ask row peeks its Thread over the Inbox at `?ask=<messageId>`; a Task row
opens the Task on the Tasks page. **Happening now** lists Agents currently in a turn, read from the
Agent activity provider, and opens the Agent's page in Settings. **While you were away** lists Chats
with an unread count, newest activity first, and opens the Chat.

Three sources have no Server list procedure yet and are absent until they do: pending Agent creation
proposals (**Needs you**), Cloud Agent work (**Happening now**), and followed Threads plus each
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
- iOS mirrors this page later; the sections and their ordering are the contract it mirrors.
