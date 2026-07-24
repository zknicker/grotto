---
summary: Durable chat API for messages, artifacts, receipts, reads, events, soft deletes, inbox delivery, and runtime metadata.
read_when:
  - changing chat messages, artifacts, receipts, history, or timeline recovery
  - changing how agent runtimes, bots, webhooks, or local tools send chat work into Tavern
  - changing the agent-token CLI surface, inbox delivery, or agent-scoped stop
---

# Chat API

The Chat API is message-first and runtime-hosted.

Agent runtimes have sessions and turns. Chat apps have messages and responses.
Tavern Runtime exposes durable messages, agent responses, response activity,
artifacts, receipts, history, and events. Execution identity rides along as
metadata.

## Source Of Truth

Tavern Runtime is the durable source for chat objects.

| Object | Durability | Store |
| --- | --- | --- |
| `chat` | Durable | Runtime SQLite |
| `message` | Durable | Runtime SQLite |
| `response` | Durable | Runtime SQLite |
| `activity` | Durable response work | Runtime SQLite |
| `artifact` | Durable renderable output | Runtime SQLite or content store |
| `delivery` | Durable receipt | Runtime SQLite |
| `event` | Recoverable notification | Runtime SQLite |

App SQLite is a cache and presentation store. Agent execution traces are
execution evidence linked to Tavern messages.

## Chats And Participants

A `chat` is a Runtime-owned conversation container. Tavern-owned chats use
`kind: "channel"` for shared room-style conversations, `kind: "dm"` for
one-to-one direct messages, and `kind: "thread"` for message-anchored child
conversations. Thread access comes from the parent chat; threads have no
independent membership. (`kind: "task"` chats belonged to the retired pre-flip
tracker; the enum value survives only until the manual cutover deletes the old
rows — nothing creates them.)

A message may carry `task` (chat-first task metadata: number, status,
assignee, priority, labels — see [Tasks](../features/tasks.md)) and
`reactions` (emoji + actor lists). The operator surface mutates them through
`/api/tasks`, `/api/messages/{id}/task`, `/api/messages/{id}/reactions`,
`/api/labels`, and reads reminders through `/api/reminders` (cancel-only —
see [Reminders](../features/reminders.md)).
Runtime does not bootstrap channels in a normal workspace. Each Runtime-managed
agent has one built-in DM with the local human operator. Built-in agent DMs are
removed from the app chat list when their agent is deleted, and clients must not
expose chat deletion controls for them.
Development mode additionally seeds the `demo` channel.

`chat.participants` is the membership contract for the chat shell. Participant
rows use Tavern product ids such as `usr_...`, `agt_...`, and `sys_...`, plus
observed `external` participants for non-Tavern frontends. Agent session
state attaches to agent participants. The app must not infer routing from a
route id or display name.

`chat.last_activity_at` is the latest undeleted durable message timestamp, or
`null` before the chat has messages. It is separate from `chat.updated_at`,
which changes when chat metadata, title, or participants change. Sidebar and
overview recency should use `last_activity_at`, not metadata update time.

An agent participant is the Chat's Agent seat. Runtime stores that seat's
current Agent session:

```http
GET  /agent/chats/{chat_id}/agent-sessions/current?agentId=
POST /agents/{agent_id}/session/reset
```

`GET current` returns the agent's global session (or `null`); the chat path
segment only resolves which agent when `agentId` is omitted. `POST reset`
takes `{ kind: 'session' | 'full' }` and is agent-wide: the active session
is archived, the next generation becomes current, `full` also wipes the
workspace, and the reset lands a durable new-session notice in the agent's
DM (specs/sessions.md). Model selection is agent-scoped: a model change
takes effect on the agent's next turn with a fresh session.

## Addressing

Sending a message never starts a turn directly. A durable `message.created`
event is planned by Runtime's inbox delivery: every joined agent in a channel
(and the one agent in a DM) is queued the message regardless of mentions; a
channel mute suppresses delivery except for a personal @mention, which pierces
as a single delivery. An idle agent wakes on a drain turn; a busy agent gets a
content-free notice. See [Agent Inbox](../../specs/inbox.md).

`chat.send` returns no turns — just the durable message's acceptance receipt
(`acceptedAt`, `chatId`, `clientMessageId`, `status`, `threadChatId`). Turns
float on the agent's session rather than anchoring to the triggering message
or chat (ADR 0014), so there is no per-message turn record to return.

## Endpoints

```http
GET    /api/chats?cursor=&limit=&reader_id=
POST   /api/chats
GET    /api/chats/{chat_id}?reader_id=
POST   /api/chats/{chat_id}/threads
PUT    /api/chats/{chat_id}/follow
GET    /api/chats/{chat_id}/messages?after_sequence=&before_sequence=&limit=
GET    /api/chats/{chat_id}/messages/search?query=&limit=
GET    /api/chats/{chat_id}/timeline?before_sequence=&limit=&reader_id=
GET    /api/chats/{chat_id}/responses?after_sequence=&limit=
GET    /api/chats/{chat_id}/activity/{activity_id}
POST   /api/chats/{chat_id}/messages
POST   /api/chats/{chat_id}/deliveries
POST   /api/chats/{chat_id}/responses
POST   /api/chats/{chat_id}/responses/{response_id}/activity
POST   /api/chats/{chat_id}/artifacts
POST   /api/chats/{chat_id}/read
GET    /api/messages/{message_id}
GET    /api/events?limit=
GET    /api/events/ws
```

The agent-facing Grotto CLI uses a separate agent-token surface:

```http
POST /api/agent/messages/send
GET  /api/agent/history
GET  /api/agent/messages/search
GET  /api/agent/messages/{id}
GET  /api/agent/server
GET  /api/agent/channels/info
GET  /api/agent/channels/members
POST /api/agent/channels/join
POST /api/agent/channels/leave
POST /api/agent/channels/mute
POST /api/agent/channels/unmute
POST /api/agent/threads/unfollow
GET  /api/agent/events
GET  /api/agent/inbox
```

`GET /api/agent/events` (`grotto message check`) serves pending envelopes and
advances the `served` cursor. `GET /api/agent/inbox` (`grotto inbox check`)
lists pending target rows without draining. See
[Agent Inbox](../../specs/inbox.md).

These routes resolve handle targets such as `#general` and `dm:@Wren` at
action time and fail closed. Channel sends use the shared freshness decision:
unseen peer rows hold a server-side draft, while history responses advance a
served high-water mark that prevents a pull-then-send race. Served state
affects holds only; the Agent session's seen ledger remains catch-up authority.

The transport can be local HTTP, tRPC wrapping, or a TypeScript SDK method. The
contract stays the same.

Chat list and detail reads accept an optional `reader_id`. Their `unread_count`
is scoped to that Tavern user and excludes messages authored by that user.
Keyless clients may omit it to use the synthetic `usr_tavern` operator.

## Tavern App Reads

The Tavern app keeps list and detail reads separate:

* `chat.list` returns ordered Tavern chat ids plus lightweight list items. It is
  the sidebar and overview contract, not a full chat detail payload. List items
  include `activeTurnParticipantIds` so compact views can show in-progress
  agent work without reading the full chat log. Channels and DMs are durable rooms in the
  app sidebar. External execution references belong to `agent.chats.list`, not
  the global Tavern chat list. Tavern chat list recency comes from
  `last_activity_at`; metadata-only edits must not make a chat look newly active.
* `chat.get` returns one full chat record by `chatId`.
* `chat.updateTabAppearance` changes the durable channel color metadata for a
  Tavern chat.
* `chat.updateSystemPrompt` changes trusted chat-specific agent instructions
  for a Tavern chat. Empty text clears the prompt.
* `chat.log.list` returns durable conversation rows for one chat: participant
  messages, widgets, artifacts, system notices (new session, compaction), and
  the changed-files summary row (`workspace_changes`) rendered as a chip
  under the agent's reply. Historical clarification rows from before agent
  turns stopped pausing for inline answers may still appear. Execution
  evidence (tool calls, reasoning, narration, prompt and file-change trace)
  never rides the timeline — it lives on the agent profile, queried per turn
  by `runId` — see [chat-timeline](../../specs/chat-timeline.md) and
  [agent-activity](../../specs/agent-activity.md). Pages walk backward from
  the newest message with a `beforeSequence` cursor; the timeline is
  append-only from the reader's seat — a new row only ever appears at the
  end, and no row moves.
* `chat.files.list` walks the full chat log and returns attachment metadata
  newest first. Entries include the attachment kind, filename, media type,
  size, sender, actor, message id, and timestamp. Inline attachment data and
  file paths are not returned.
* `chat.turn.evidence` returns one turn's execution record — tool, reasoning,
  narration, and worker rows plus artifacts — by `chatId` + `responseId`. The
  turn drawer queries it on demand; live turns stream evidence through turn
  progress events instead.
* `chat.turn.fileChanges` returns one turn's workspace file-change evidence by
  `runId` (Runtime `GET /api/turns/{run_id}/file-changes`): the files the turn
  created, modified, or deleted, with bounded before/after text for diff
  rendering. The transcript's "Changed N files" row carries only the summary;
  the drawer fetches contents through this query on demand. Null when no
  Runtime is connected or the turn recorded no changes.

Invalidate `chat.list` when membership or list ordering can change. Invalidate
`chat.get` when one chat's detail fields can change. Message and artifact
events update the app timeline by stable ids. Channel color and system prompt
changes invalidate `chat.list` and the changed `chat.get` record.

`agent.stop` is the agent-scoped interrupt (I1): it stops the agent's running
turn and clears its queued backlog wherever the agent is running, not a
single chat's turn. It does not delete the triggering message or any
previously delivered output.

There is no steer mutation and no composer queue: sending while an agent is
mid-turn is a normal message send. Runtime attempts busy delivery of the new
message into the agent's running turn; when it cannot, the message reaches
the agent through its next drain's catch-up instead (see
[Agent Inbox](../../specs/inbox.md)). Model changes are Runtime session
controls, not message composer payloads.

## Messages

`POST /api/chats/{chat_id}/messages` creates a durable user, assistant, or
system message before work starts.

Messages have one text body and durable attachments. Agent work such
as thinking summaries, tool calls, tool results, assistant progress, and status
updates belongs to `response` and `activity` records, not message body fields.

Harness-native tools come from the selected executor. Runtime adds only the
host tools and MCP tools granted to that agent; MCP grants are rechecked at
call time. Exposed tools are auto-approved unless Runtime adds a narrower
approval policy. Tavern does not expose an approval response endpoint.

Request:

```jsonc
{
  "id": "msg_...",
  "nonce": "client-send-...",
  "author_id": "usr_...",
  "role": "user",
  "content": "Run the report.",
  "attachments": [],
  "metadata": {
    "runtime": {
      "source": "agent-engine",
      "agentId": "main",
      "agentSessionId": "ags_...",
      "runId": "run_..."
    }
  }
}
```

Response:

```jsonc
{
  "cursor": "94",
  "idempotent": false,
  "message": {
    "id": "msg_...",
    "chat_id": "cht_...",
    "sequence": 12,
    "author": {
      "id": "usr_...",
      "kind": "user",
      "label": null,
      "metadata": {}
    },
    "role": "user",
    "content": "Run the report.",
    "attachments": [],
    "nonce": "client-send-...",
    "delivery_id": null,
    "deleted_at": null,
    "created_at": "2026-05-17T00:00:00.000Z",
    "metadata": {}
  }
}
```

Duplicate creates are idempotent:

* Same `message.id` returns the existing message and receipt.
* Same `(chat_id, nonce)` returns the existing message and receipt.
* Same logical message never creates a second durable row.
* Content, timestamp, and display text are never duplicate keys.

New server-minted message ids use `msg_` plus 32 UUID hex characters. Agent
routes accept a unique first-eight-hex short id and return `AMBIGUOUS_ID` when
more than one full id matches. Existing ids remain unchanged and resolve only
by their full value.

## History

`GET /api/chats/{chat_id}/messages` returns durable messages ordered by
per-chat `sequence`.

Rules:

* `after_sequence` and `before_sequence` are exclusive cursor windows.
* `limit` is clamped by the server.
* Soft-deleted messages keep their sequence slot.
* Message `content` and `attachments` are hydrated with the row.
* Authors are hydrated enough for clients to render without a second lookup.

`GET /api/chats/{chat_id}/messages/search` returns matching durable messages
from that chat. Search is case-insensitive keyword search over canonical message
content and returns newest matches first.

`GET /api/chats/{chat_id}/timeline` returns one turn-aligned page of chat
history: a message window walked backward by sequence plus every response
anchored to a window message by request or reply, with that response's full
activity and artifacts. The page also includes one thread summary per anchor,
with reply, unread, and follow state for the requesting reader.

Rules:

* `before_sequence` is an exclusive upper bound; omit it for the latest page
  and pass the page's `next_before_sequence` to walk older history.
* The window extends downward so an in-window reply always ships with its
  request message. A turn whose request and reply straddle a page boundary is
  anchored to both pages; consumers deduplicate by id.
* Responses with no message anchor (live or automation turns not yet linked)
  ride the latest page only.
* `total_messages` counts the chat's durable messages.

Runtime sessions can have their own sequence domains. Preserve runtime sequence
in metadata or source fields; never use it as the Tavern timeline cursor.

## Chat Instructions

Tavern chats can carry trusted chat-specific instructions in
`metadata.tavern.groupSystemPrompt`. Tavern passes that value through the
agent turn adapter for the chat. Generated temporary chat titles do not become
durable execution labels; explicitly renamed chats may use their display name
as the conversation label.

## Deliveries And Activity

Agents write their own reply messages directly (`grotto message send`); the
delivery/response/activity objects below are not created for real agent
turns. They remain a real, schema-backed part of the API — used by seeded
chat demos and available to external clients — but live execution evidence
for a turn is the agent-scoped model instead: `agent_turns` rows, per-turn
prompt and file-change evidence (`chat.turn.fileChanges`, keyed by `runId`),
and the agent activity feed. See [Agent Activity](../../specs/agent-activity.md).

`POST /api/chats/{chat_id}/deliveries` records an assistant delivery receipt and,
when text is final, creates or links the assistant message.

Request:

```jsonc
{
  "id": "del_...",
  "agent_id": "agt_...",
  "turn_id": "run_...",
  "message": {
    "id": "msg_assistant_...",
    "author_id": "agt_...",
    "role": "assistant",
    "content": "Done.",
    "attachments": [],
    "metadata": {}
  },
  "metadata": {
    "runtime": {
      "source": "agent-engine",
      "agentId": "main",
      "agentSessionId": "ags_...",
      "engineSessionId": "...",
      "runId": "run_..."
    }
  }
}
```

Response:

```jsonc
{
  "id": "del_...",
  "message": { "id": "msg_assistant_..." },
  "cursor": "101",
  "idempotent": false
}
```

Duplicate `delivery.id` returns the existing delivery receipt. Duplicate
assistant `message.id` links the delivery to the existing durable message
instead of creating a second row.

## Activity

Activity is durable work performed as part of a response.

A response is one participant's attempt to answer or act on a chat message. Most
responses are authored by agents, but the Tavern noun stays chat-first: agent
turns, runs, and transcript ids are runtime metadata on the response, not the
product identity.

Activity can include:

* thinking summaries
* tool calls and tool results
* commands
* code snippets
* image, file, diff, or document outputs
* final assistant message references

Activities are ordered inside their response and carry status:
`queued`, `running`, `completed`, `failed`, or `cancelled`. Runtime upserts
activity rows while work is happening, then marks the same rows complete or
failed when results arrive. Reload recovery reads the same durable activity rows
for running and completed responses.

Common activity kinds:

| Kind | Use |
| --- | --- |
| `planning` | Current plan or task list. |
| `reasoning` | Provider-exposed thinking summary. |
| `message` | Assistant progress or structured status text before the final message. |
| `tool_call` | Runtime tool work with stable tool identity. |
| `tool_result` | Tool result material when it is represented separately. |
| `command` | Shell-like command work when the runtime exposes it as a command. |
| `artifact` | Renderable output, patch, file, image, document, or diff summary. |
| `widget` | App-rendered assistant UI from a validated Widget payload. |
| `custom` | Runtime-specific activity with typed metadata. |

Clients open activity detail surfaces by stable activity id:
`GET /api/chats/{chat_id}/activity/{activity_id}`. The returned row is the same
durable activity used by timeline rendering, including runtime tool metadata and
artifact links.

Activity ids are global Tavern ids. Updating an activity id that belongs to a
different chat or response is a contract error. Runtime adapters must include
turn identity when their source item ids can repeat across turns.

```jsonc
{
  "id": "act_...",
  "response_id": "rsp_...",
  "kind": "tool_call",
  "status": "completed",
  "title": "bash",
  "detail": "sed -n '1,220p' docs/api/chat.md",
  "artifact_ids": ["art_..."],
  "metadata": {
    "runtime": {
      "source": "agent-engine",
      "agentSessionId": "ags_...",
      "turnId": "...",
      "toolCallId": "call_...",
      "toolName": "bash"
    }
  }
}
```

## Artifacts

Artifacts are durable renderable outputs produced by messages or response
activity.

Examples:

* code blocks and command output
* screenshots and generated images
* files and file previews
* diffs
* documents, spreadsheets, and charts

Artifacts are not tool calls by themselves. Tool-call activity may reference one
or more artifacts when it produces renderable output.

Hidden chain-of-thought is not part of the API. Reasoning text is allowed only
when the runtime exposes a user-visible summary.

## Reads

`POST /api/chats/{chat_id}/read` accepts
`{ "reader_id": "usr_...", "last_read_sequence": 12 }` and advances the
reader's monotonic read pointer for that chat.

Read events are private to the reader. Event list and websocket delivery
include them only when `recipient_id` matches `reader_id`.

## Events

Message, response, activity, artifact, delivery, update, delete, and read
mutations emit recoverable events.

Durable events are inserted in the same transaction as the mutation they
describe:

* `message.created`
* `message.delivered`
* `message.updated`
* `response.created`
* `response.updated`
* `response.completed`
* `response.failed`
* `response.deleted`
* `activity.created`
* `activity.updated`
* `activity.completed`
* `activity.failed`
* `artifact.created`
* `chat.read`
* `chat.cleared`

Event shape:

```jsonc
{
  "id": "evt_...",
  "cursor": "101",
  "type": "message.created",
  "chat_id": "cht_...",
  "created_at": "2026-05-17T00:00:00.000Z",
  "private": false,
  "recipients": [],
  "message": {}
}
```

Websocket delivery is a notification pipe. Clients recover missed state through
durable chat reads.

## Clearing And Response Dismissal

Messages have no edit or delete API. Corrections belong in thread replies.
`DELETE /api/responses/{response_id}` soft-deletes a response; its activity and
artifacts follow it out of the timeline.
`POST /api/chats/{chat_id}/clear` soft-deletes every message and response
currently in the chat in one operation and emits one `chat.cleared` event.

Chat clear sets `deleted_at`, keeps rows, and preserves per-chat sequence slots
so cursors remain stable. Dismissing a failed response rides the response
contract.

## Runtime Metadata

Agent execution identity stays in metadata:

```text
runtime.source
runtime.agentId
runtime.agentSessionId
runtime.engineSessionId
runtime.runId
runtime.turnId
runtime.deliveryId
runtime.transcriptMessageId
runtime.toolCallId
runtime.toolName
```

Agent transcript sync upserts by stable Tavern ids when they are present.
Transcript rows without Tavern identity remain execution evidence. Tavern links
them through response and activity metadata when possible; they are not matched
to existing Tavern messages by content or timestamp.

## What Is Intentionally Missing

* Per-message edit or delete.
* Content/timestamp duplicate detection.
* Hidden chain-of-thought as message content or activity.
* Runtime session sequence as the Tavern timeline cursor.
* Agent transcript rows as canonical chat history.

## Related Docs

* [Realtime](realtime.md)
* [Data model](../internals/data-model.md)
* [Chat feature](../features/chat.md)
* [Tavern Runtime Chat Server](../../specs/runtime-chat-server.md)
* [Agent Engine Runtime](../internals/agent-engine-runtime.md)
