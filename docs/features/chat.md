---
summary: Agent chat experience — durable messages, the ephemeral composition bubble, artifacts, receipts, and channel/DM structure. Execution evidence lives on the agent profile, not the chat.
read_when:
  - changing the main agent conversation experience
  - changing durable messages, the composition bubble, artifacts, or receipts
  - changing channel/DM structure, archiving, or chat appearance
---

# Chat

Chat is Grotto's primary workspace. Users talk to one or more agents and keep
the durable timeline as context. Agents speak only by sending messages
(`grotto message send`); see [ADR 0014](../adr/0014-cli-is-the-agents-only-output-channel.md)
and [Agent Inbox](../../specs/inbox.md).

## In the box

* **Durable messages.** User, assistant, and Server-authored system rows are stable history.
  Task creation and promotion can add a concise system receipt to the parent Chat; it is an
  informational timeline row, while the task message and its Thread remain canonical.
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
  app-local pending row carries the text at the tail of the transcript until
  the durable message arrives. Rapid sends queue as separate pending rows,
  each matched to its durable message by send nonce; a failed send drops its
  row and restores the whole draft, attachments included. Thread replies send
  the same way, including the first reply, whose pending row belongs to the
  anchor message until the Thread it creates exists. Pending rows are never
  written into durable chat history.
* **Composition bubble.** While an agent's send is in flight, a provisional
  bubble renders at the target chat, swapped for the durable message once it
  commits, retracted on a freshness hold, and TTL-faded if the send is
  abandoned. On a hosted Server, the Server's volatile Agent lifecycle feed
  opens the bubble for `sending` and clears it when the send returns to
  `reading`; the durable `message.created` event then refreshes the canonical
  timeline. It is ephemeral app state, never persisted or replayed. No
  working, reading, tool, or reasoning phase creates a Chat row.
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
  the sidebar. Each Grotto channel and DM has Chat and Files tabs; Files
  lists attachments from its messages. Channels render with a hash icon and
  optional channel color. Opening a Server restores that Server's last visited
  Chat when it still exists, then falls back to `#all` or the first available
  Chat.
  Opening a chat shows a room topbar with the chat name and a participant
  count. On channels the name is a dropdown with channel actions, the optional
  channel description sits beside it (both open the Edit channel dialog, which
  renames the channel or updates its description), and the participant count
  opens the participants dialog. The description also frames agent turns: each
  turn's prompt carries the channel's name and description, so agents treat it
  as the room's purpose. Users create channels by naming the channel
  and choosing its agent participants.
  Archive channel is an Owner/Admin action for a regular channel. It hides the
  channel from the active sidebar without deleting history. The sidebar's
  Archived entry opens the archived channel view (`/s/:slug/archived`), where
  a channel can be reopened or restored. An open archived channel shows an
  Archived badge and a restore bar in place of the composer. Its history,
  search results, deep link, and child Threads remain readable, but new
  messages, tasks, reactions, attachments, compositions, and reminder output
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
  built-in DM with the local human operator. Agent DMs are not user-deleteable;
  retiring the Agent removes its built-in DM from active navigation. The durable
  Chat remains canonical history. Deleted Agents and departed humans stay visible
  on authored transcript messages with muted identity and a `DELETED` badge.
  There is no separate pinned-chat state.
* **Chat appearance and instructions.** Grotto chats can carry durable channel
  color and trusted chat-specific agent instructions.
* **Offline catch-up.** Grotto Runtime keeps chat history while the app is
  closed; the app reloads from durable rows and refetches on reconnect.
* **Attention.** Agents join channels, follow threads, and mute channels
  themselves; a personal @mention pierces a mute as a single delivery. Humans
  steer agent attention by asking in chat, not by muting on the agent's
  behalf — see [Agent Inbox](../../specs/inbox.md).
* **Agent profile pane.** Clicking an agent's transcript avatar opens the
  Agent profile in the resizable right pane. The pane is a full-height app
  column with its own topbar beside the chat topbar. Artifact, Agent profile,
  and thread panes share one visible slot and width per chat; the latest
  opener wins without clearing another pane's state. Clicking the transcript name
  inserts an Agent mention, while the DM topbar name remains inert. Session
  resets stay agent-wide in Agent settings (specs/sessions.md); their durable
  new-session notice attaches to the agent's next turn as a header-action
  hover affordance instead of rendering standalone. Execution evidence (turn
  status, activity feed, prompt and file-change trace) lives entirely on the
  profile, not in the chat pane — see [Agent Activity](../../specs/agent-activity.md).
* **Stop.** Stop is agent-scoped, not chat-scoped: it interrupts the agent's
  current turn and clears its queued backlog wherever it is running.
* **Dismissal.** Failed-turn banners can be dismissed with a hover X. The
  dismissal soft-deletes the durable row in Grotto Runtime — sequence slots
  and history records are retained, and the result syncs to every client.

## Timeline inputs

The timeline combines three inputs:

| Input | Owner | Role |
| --- | --- | --- |
| Durable messages | Grotto Runtime | Canonical timeline rows |
| Artifacts | Grotto Runtime | Rich renderable outputs |
| Composition bubbles | Server UI (ephemeral) | In-flight agent send preview |
| Optimistic local rows | Server UI | One-frame accepted-message handoff |

Rendering rules:

* key user and assistant rows by durable message id
* key artifacts by artifact id
* replace optimistic rows and composition bubbles by durable message id
  (matched on `compositionId`)
* recover reloads from Runtime messages and artifacts

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

Channel color is durable Grotto chat metadata. It colors the channel hash icon
and supporting room chrome only; it does not change chat membership, message
ordering, or archive behavior. Grotto chats can also carry trusted system
prompt text that Grotto passes through Runtime prompt composition for that
chat.

## Contract

The feature contract lives in [Chat API](../api/chat.md).
