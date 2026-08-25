---
summary: Agent chat experience — durable messages, artifacts, and channel/DM structure. Execution evidence stays outside the timeline.
read_when:
  - changing the main agent conversation experience
  - changing durable messages, composer behavior, or artifacts
  - changing channel/DM structure, archiving, or chat appearance
---

# Chat

Chat is Grotto's primary workspace. Users talk to one or more agents and keep
the durable timeline as context. Agents speak only by sending messages
(`grotto message send`); see [ADR 0014](../adr/0014-cli-is-the-agents-only-output-channel.md)
and [Agent Inbox](../../specs/inbox.md).

## In the box

* **Durable messages.** User, assistant, and Server-authored system rows are stable history.
  The timeline carries conversation units only — messages, artifacts,
  notices, thread anchors — and nothing turn-shaped. See
  [chat-timeline](../../specs/chat-timeline.md).
* **Hosted attachments.** A human can attach local files to a hosted Server
  message. The App streams bytes directly to that Server, publishes the ready
  attachment and message atomically, renders filename/type/size metadata, and
  downloads through an authenticated Server request. Attachment bytes never
  ride message-list payloads and never pass through a Computer or Agent
  workspace. Hosted attachments are not Chat artifacts.
* **Sending.** A human send is instant. The draft leaves the composer the
  moment it is sent, the composer stays enabled for the next message, and an
  app-local pending message carries the text at the tail of the transcript until
  the durable message arrives. Pending and durable messages pass through the same
  transcript grouping, so rapid sends keep the same avatar and name structure when
  they commit. Each pending message is matched to its durable message by send nonce;
  a failed send drops its message and restores the whole draft, attachments included. Thread replies send
  the same way, including the first reply, whose pending row belongs to the
  anchor message until the Thread it creates exists. Pending rows are never
  written into durable chat history.
* **Changed files.** A turn that creates, modifies, or deletes workspace files
  shows a "Changed N files" chip under the agent's reply, and the full
  per-file diff view. Selecting text in a diff or workspace file preview
  offers "Quote in chat", inserting the quoted lines plus a `grotto://`
  source link into the composer — the universal review gesture.
* **Artifacts.** Code, images, files, diffs, documents, and charts render as
  durable outputs attached to messages.
* **Receipts.** Message creation is acknowledged by id. Sends return no
  turns — delivery to agents is planner-owned (see
  [Agent Inbox](../../specs/inbox.md)).
* **Channels and DMs.** Channels and direct messages are durable chat rooms in
  the sidebar. Every chat's name is a dropdown menu offering its chat-scoped
  surfaces: View tasks opens the Tasks page filtered to the chat, and Files
  opens a side pane listing attachments from its messages. Channels render with
  a hash or chosen catalog icon and optional channel color. Opening a Server
  restores that Server's last visited Chat when it still exists, then falls back
  to `#all` or the first available Chat. A user can drag any part of a Channel
  row to reorder it, or use Space and the arrow keys while the row is focused. The App keeps that
  personal presentation order per Server on the current device; direct messages
  retain the Server list order.
  Opening a chat shows a room topbar with the chat name. On channels the name's
  dropdown also carries channel actions. Editing a channel is three separate
  decisions, each with its own dialog: Rename channel, Icon & color, and Agents,
  which carries the participant count. Archive and delete follow them for a
  regular channel. Users create channels in one New channel dialog that names
  the channel, picks its icon and color from a trigger inside the name field,
  and chooses its agent participants.
  Archive channel is an Owner/Admin action for a regular channel. It hides the
  channel from the active sidebar without deleting history. The Server menu's
  Archived chats entry opens the archived channel view (`/s/:slug/archived`), where
  a channel can be reopened or restored. An open archived channel shows an
  Archived badge and a restore bar in place of the composer. Its history,
  search results, deep link, and child Threads remain readable, but new
  messages, tasks, reactions, attachments, and reminder output
  in the aggregate are rejected. Archive cancels undrained
  Agent inbox work for the aggregate; already accepted turns cannot send back
  after the transition. Restore permits new work without replaying canceled
  envelopes.
  Delete channel is a separate irreversible Owner/Admin action guarded by the
  exact channel name. It removes the regular channel, child Threads, messages,
  tasks, reads, reactions, reminders, delivery rows, search state, attachment
  metadata, and attachment bytes. `#all`, DMs, and Threads have no independent
  archive/delete action. New workspaces
  start with no user channels. Each agent has one
  built-in DM with its human participant, addressed by that person's Server
  handle. Agent DMs are not user-deleteable;
  retiring the Agent removes its built-in DM from active navigation. The durable
  Chat remains canonical history. Deleted Agents and departed humans stay visible
  on authored transcript messages with muted identity and a `DELETED` badge.
  There is no separate pinned-chat state.
  Right-clicking a sidebar chat or its topbar name exposes the same contextual
  actions without replacing the ordinary click target. Channel menus also offer
  direct color presets and the existing rename, appearance, and participant
  dialogs; DM menus link to their scoped tasks and Agent profile.
* **Message and Thread context.** Right-clicking a durable message offers copy,
  reply-in-Thread, and quick reactions. Agent messages additionally open Turn
  Details. A Thread header offers View in chat, Copy reference, and Follow/Stop
  following through both its name dropdown and its context menu.
* **Chat appearance and instructions.** Grotto chats can carry durable channel
  color and trusted chat-specific agent instructions.
* **Offline catch-up.** Grotto Server keeps chat history while the App is
  closed; the app reloads from durable rows and refetches on reconnect.
* **Attention.** Agents join channels, follow threads, and mute channels
  themselves. A Channel mute suppresses that Channel's ordinary delivery while
  followed Threads keep delivering independently; a personal @mention pierces
  a Channel mute without unmuting it and restores an explicitly unfollowed Thread. Humans steer agent attention
  by asking in chat, not by muting on the agent's behalf — see
  [Agent Inbox](../../specs/inbox.md).
* **Agent profile pane.** Clicking an agent's transcript avatar opens the
  Agent profile in the resizable right pane. The pane is a full-height app
  column with its own topbar beside the chat topbar. Artifact, Agent profile,
  and thread panes share one visible slot and width per chat; the latest
  opener wins without clearing another pane's state. Clicking the transcript name
  inserts an Agent mention, while the DM topbar name remains inert. Session
  resets stay agent-wide in Agent settings (specs/sessions.md); their durable
  new-session notice attaches to the agent's next turn as a header-action
  hover affordance instead of rendering standalone. Execution evidence (turn
  status and Activity History) lives on the profile. An Agent message's Turn Details drawer may
  show its Server summary and, for Owners/Admins with an online Computer, relay the detailed local
  execution journal — see [Agent Activity](../../specs/agent-activity.md).
* **Stop.** Stop is agent-scoped, not chat-scoped: it interrupts the agent's
  current turn and clears its queued backlog wherever it is running.
* **Dismissal.** Failed-turn banners can be dismissed with a hover X. The
  dismissal soft-deletes the durable Server row — sequence slots
  and history records are retained, and the result syncs to every client.

## Timeline inputs

The timeline combines three inputs:

| Input | Owner | Role |
| --- | --- | --- |
| Durable messages | Grotto Server | Canonical timeline rows |
| Artifacts | Grotto Server | Rich renderable outputs |
| Optimistic local rows | Grotto App | One-frame accepted-message handoff |

Rendering rules:

* key user and assistant rows by durable message id
* key artifacts by artifact id
* reconcile optimistic rows by durable message id
* recover reloads from Server messages and artifacts

## App Data Flow

The app reads chat list and detail data separately. `chat.list` is the
lightweight ordered list contract for Grotto sidebars, overviews, and chat
pickers. Agent pages use `agent.chats.list` when they need the combined Grotto
and external runtime chat inventory.
`chat.get` is the focused detail read for a single chat. Timeline rows come
from `chat.log.list` — durable messages and artifacts, paged by message
sequence. When a user opens a Chat from the sidebar, the route renders that
selected `chat.list` record immediately while `chat.get` loads, so the Chat
surface never drops out between selections.

## Chat Appearance

Channel icon and color are durable Grotto chat metadata on the `Chat` record
(`icon`, `color`; both null on DMs and threads). `icon` names one entry from the
curated hugeicons catalog generated by
`apps/website/scripts/generate-channel-icon-catalog.ts` (about 1,000 solid
glyphs, one per icon family, chrome and brand families excluded); null renders
the default hash. `color` is a preset id from
`apps/website/src/components/chats/channel-color-options.ts`, which derives the
light and dark glyph and box tints. Both are set from the appearance picker
inside the New channel dialog's name field, or from an existing channel's Icon &
color dialog. Both show the same control: one toolbar row that searches the
catalog, opens the color presets, and resets to the hash, with the icon grid
under it. They change only the channel glyph box in the sidebar, topbar, command
menu, and the Agent profile's chat list, and never affect membership, message
ordering, or archive behavior. The App loads the icon catalog as a lazy chunk and
shows the hash until it arrives. The iPhone app renders the same glyph and tint
from a bundled copy of that catalog's geometry — in its sidebar, chat header,
chat details, search results, and archived list — and shows the hash while that
resource loads or when the stored name is unknown. It has no appearance editor.
Grotto chats can also carry trusted system
prompt text that Grotto passes through Computer prompt composition for that
chat.

An offline Computer does not make Chat history unavailable. Pending work remains Server-owned until
the assigned Computer can receive it. The App may show optimistic local rows while a send is in
flight, but it never patches those rows into canonical history before acknowledgement.

## Contract

The deeper product contract lives in [Chats](../../specs/chats.md).
