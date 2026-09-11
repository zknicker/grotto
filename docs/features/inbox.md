---
summary: The human Inbox page — a sidebar lens over the day, the week's most active Agents, Asks, live Agent work, and unread conversation.
read_when:
  - changing the Inbox page, its sections, empty states, or realtime invalidation
  - adding a record that should ask a human to act or should stay observable between turns
  - deciding where background work that outlives an Agent turn becomes visible to humans
---

# Inbox

The Inbox is a Haus App page in the sidebar. Its row is the sidebar's anchor — first in the
Inbox/Search/Tasks menu, wearing the Haus ghost mark, which turns iridescent while any Agent is
working. The row badges the **Needs you** total in the same count chip the Channel and DM rows wear
for unread messages, and shows nothing when nothing needs you. It shows one human what they need to
know right now.

The Inbox is a lens, not a store. It owns no state of its own, creates no records, and duplicates no
lifecycle. Every row projects an existing Server record and links to that record's canonical place —
a Chat, a Thread, or an Agent profile.

The agent-side concept with a similar name is the [Agent inbox](../../specs/inbox.md), the durable
delivery ledger that wakes Agents. Say "Agent inbox" wherever the two could be confused.

## Layout

The page opens on a header with no card: the greeting that names the reader, and the weekday and
date beneath it. Under that sits the **Active this week** strip, and under that three full-width
sections stacked in reading order — **Needs you**, **Conversations**, **Happening now** — in the
page column's own rhythm.

They stack rather than split because a row is one line tall. Three-line rows made each section a
tall narrow thing, and two columns were how a 1152px page held them; a one-line row makes a section
a wide shallow one, and every part of that row — the title, the preview it leaves room for, and the
trailing meta — wants width. Splitting the page took width from all three at once.

## Sections

**Active this week** is the one uncarded section: a small label over a horizontally scrolling row of
Agent cards, which already carry their own edges. Each card is one Agent — its 24px avatar and name
on the header line, then the number of turns it ran in the last seven days as the figure, that
week's daily counts as a sparkline beside it, and one muted line naming what the figure counts. An
Agent that is mid-turn spends that line on the step it is on and its elapsed time, in accent.
Pressing a card opens that Agent's DM, or its profile when it has no DM yet.

The strip is not a roster. A Server can hold thirty-five Agents, and a card for every one of them is
a wall to scan rather than a thing to read. It carries only Agents that ran at least one turn in the
window or are running a turn now, working Agents first, then the busiest week, then the name, capped
at eight. When none qualify it says **No Agent activity this week**; while the read is unsettled it
shows nothing at all, because a partly-loaded set would rank Agents against zeroes and reorder under
the reader. The ranking is a Server-wide question, so it comes from one Server read — `agent.recentTurns`,
every Agent's turns in the window — which the page groups by Agent rather than asking once per Agent
([`use-agent-week-turns.ts`](../../apps/website/src/features/servers/inbox/use-agent-week-turns.ts)).

The remaining three sections share one grammar: a bordered group carrying the title, and exactly one
divided list inside it. A quiet section says so in one muted row inside that same group.

**Needs you** — work waiting on this human, as one list over two records:

- Open [Asks](../../specs/asks.md) addressed to me, with the recommended step as a button.
- Claims an Agent took and stopped short of finishing.

They share a list rather than a card. As two lists in one group, the seam between them was the only
place in the section without a divider, and the reader could see the join.

A failed Server onboarding is not here. The Cove gate holds every owner on the setup screen
until onboarding completes, so the only person who could reach an Inbox row about it is a member who
cannot act on it; the failure states itself on the gate instead.

Tasks are not here. Task tiers made a task the Agent's own ledger, the Tasks page already leads with
its **Needs your review** group, and an [Ask](../../specs/asks.md) is the record that addresses a
person — so `in_review` rows in the Inbox only made the section long enough that the Asks stopped
being the point.

**Conversations** — unread Chats, newest activity first: the Chat's identity and name, the last
message beside it, and the time and unread count trailing. The quoted line is flattened by the same
helper every other quoting surface uses, so a reference reads as `#product` and a visual reads as its
title. A Chat holding no message yet says so instead.

The author prefix is dropped when the row's own title already answers it. In a DM the peer Agent
speaks unattributed — `Tiny: Finished the audit` inside Tiny's own DM stated the name twice — and
only the viewer's own line is marked, as `You:`. A Channel keeps every name, because there the
author is the fact the reader is scanning for. `ChatLastMessage` carries no author id, so the match
is by display name; it is a presentation choice inside one row and never identity, and the worst a
collision does is drop or add a prefix.

**Happening now** — work running right now, whether or not this human started it, also as one list:

- [Cloud Agent work](../../specs/cloud-agents.md) queued or running anywhere on the Server I can
  see, led by its provider glyph: the title, the Chat and Agent it came from as its preview, and its
  status disc with the elapsed time trailing — `Running · 25m`.
- Agents currently in a turn, from the same data as the Agent activity strip
  ([Agent Activity](../../specs/agent-activity.md)), each stating its current step and how long it
  has been on it — `Editing files · 3m`. The snapshot carries one event per Agent, so that span is
  time in the current step; the run's own start is not part of this projection.

This is where background work that outlives an Agent turn stays observable.

## Row anatomy

Every row in every list is one line tall — a 40px band — and reads left to right in the email-inbox
grammar:

- A 24px leading mark: the Agent's own avatar, a Channel's icon box, or a Cloud Agent provider
  glyph.
- The **title**, which keeps its own width rather than shrinking, and truncates only past 40% of the
  line so one long title cannot take the preview's width with it.
- The **preview**, muted, filling whatever the title leaves and truncating first: an Ask's summary,
  a Chat's waiting line, the Chat and Agent behind a Cloud Agent work.
- The **trailing cluster**, which never wraps or shrinks: where the row came from — an Ask reads
  `Ask · #onboarding-owner`, a stalled claim `#all · Task #3` — and the one control that acts on it,
  the recommended-step button or the unread count. An Ask whose send failed is the only row that
  grows past one line, and it grows by exactly the error.

An Ask leads with the asking Agent's face, not a question glyph, so every row in the section shares
one identity grammar. The row is composed from ListView's own parts in
[`inbox-row.tsx`](../../apps/website/src/features/servers/inbox/inbox-row.tsx); the band itself is
one BEM override on `.list-view--inbox` in `styles/default-theme.css`, which trades the stacked
row's block padding for a fixed height.

## Current stub

The page is live at `/s/:slug/inbox`. An Ask row peeks its Thread over the Inbox at
`?ask=<messageId>`; a Cloud Agent work row peeks its conversation at `?work=<messageId>` — the same
Thread timeline the Chat opens, work card and all; a stalled claim opens the task on the Tasks page;
an Agent row in **Happening now** opens that Agent's page.

A **stalled claim** row is where a person learns that an Agent took work and dropped it, because
[Chat hides an Agent's own claims by default](tasks.md). It is composed from the same `task.list`
read the section already makes — a task with `origin` `claimed`, status `in_progress`, tier
`tracked`, and `live` false, meaning its run settled without answering and no reply is coming — and
reads as the Agent's avatar, `Blippy stopped before finishing`, what was asked as its preview, and
the Chat and task number trailing.

One source has no Server list procedure yet and is absent until it does: followed Threads
(**Conversations**).

## Rules

- Each section states its own explicit empty state, as a quiet row inside its own group. A quiet
  section says so; it does not collapse into the section above it, and it does not change shape to
  say it.
- A section stays blank while its reads settle. An unsettled query is not an empty collection, so
  nothing is claimed — and nothing flashes — on the way there. This holds for the header, which
  waits for the name it greets, and for the week strip, which waits for its one turn read rather than
  ranking against zeroes.
- The page updates from the durable events the underlying records already emit — `ask.updated`,
  `task.updated`, `cloud-agent-work.updated`, Agent activity and lifecycle, and `message.created` —
  through the existing invalidations. The Inbox adds no event of its own.
- The Inbox owns no read state. Unread counts come from `chat_reads`; open and answered come from
  the Ask, Task, and work records. Opening the Inbox marks nothing read.
- The Inbox adds no store, no cache, and no page-local lifecycle. Authorization is the ordinary
  Server membership and Chat access of each projected record.
- iOS mirrors this page later; the sections and their ordering are the contract it mirrors. No iOS
  Inbox exists yet, and Cloud Agent work has no iPhone presentation either.
