---
summary: Hosted collaboration and reminder receipts plus the local Runtime chat contract for messages, reads, search, events, execution, and delivery.
read_when:
  - changing chat messages, artifacts, receipts, history, or timeline recovery
  - changing hosted reminder receipts, operator procedures, or attention snapshots
  - changing how agent runtimes, bots, webhooks, or local tools send chat work into Grotto
  - changing the agent-token CLI surface, inbox delivery, or agent-scoped stop
---

# Chat API

The Chat API has a hosted collaboration surface and a local Runtime
execution surface. The hosted surface is canonical for Server Channels, DMs,
human and Server-authored system messages, reads, search, and durable events. It does not require
a Computer.

Agent runtimes have sessions and turns. Chat apps have messages and responses.
Grotto Runtime exposes agent responses, response activity,
artifacts, receipts, history, and events. Execution identity rides along as
metadata.

## Hosted Chat

The App calls the hosted Server directly over typed tRPC:

| Procedure | Contract |
| --- | --- |
| `chat.list` | Accessible active Channels and DMs with Server-owned unread counts |
| `chat.listArchived` | Accessible archived regular Channels |
| `chat.get` | One accessible Chat by id, including archived Channels |
| `chat.archiveChannel` / `chat.unarchiveChannel` | Owner/Admin reversible regular-Channel lifecycle transition |
| `chat.deleteChannel` | Owner/Admin irreversible regular-Channel aggregate deletion; exact name confirmation |
| `chat.ensureDm` | Resolve or create the sorted two-human DM for both current membership stints |
| `chat.messages` | Stable sequence page for one authorized Chat |
| `chat.send` | Immutable message create; optional anchor target creates/posts to a child Thread |
| `chat.markRead` | Monotonic reader-derived high-water mark |
| `chat.search` | PostgreSQL full-text search across accessible top-level Chats |
| `chat.eventHead` | Current per-Server durable cursor for first subscription |
| `chat.events` | Durable event catch-up after a cursor |
| `chat.onEvent` | Live durable-event notification; clients refetch exact resources |
| `chat.publishComposition` / `chat.onComposition` | Best-effort, live-only composition state |
| `attachment.reserve` | Idempotently allocate one Server/Chat-scoped attachment id |
| `attachment.inventory` | Owner/Admin-only database and relative filesystem inventory |
| `thread.get` | Parent and anchor ids for one authorized child Thread |
| `thread.setFollow` | Persist the caller's ordinary Thread attention state |
| `task.list` | Authorized Server task/message projections with parent Chat identity and current Thread summary |
| `task.create` / `task.promote` | Atomically create a task-message or idempotently promote one canonical message |
| `task.claim` / `task.unclaim` | Versioned self-ownership transitions |
| `task.assign` / `task.assignees` | Admin assignment and task-scoped eligible-human options |
| `task.update` | Versioned status, priority, and label mutation |
| `taskLabel.list/create/update/delete` | Shared task-specific Server label catalog |

Every input carries `serverId`; the Server derives the actor or reader from the
verified Clerk User and current Server membership. Channel access comes from
`channel_participants`. A DM records the sorted two-User pair plus each
membership's current stint. A returning human cannot reopen a DM or child
Thread from a former stint; the peer who never left retains that history.

Each human DM names the other human with `peerUserId`. An Agent DM carries
`peerAgentId`, `peerAgentDisplayName`, and `peerAgentRetired`. Retiring an Agent
keeps this list item and its history readable but makes new messages, Thread
replies, and task-message creation a conflict.
The App opens a human DM from an author already visible in an accessible
transcript; the member directory is a management surface and starts no Chats.
Invitation and membership procedures live in
[Grotto Server](../internals/grotto-server.md#membership).

Message order is the positive per-Chat `sequence`, allocated while the Chat row
is transactionally locked. `(server_id, chat_id, nonce)` is unique. Retrying
the same actor, content, and ordered attachment ids returns the original
message and event cursor; reusing the nonce for a different send is a conflict.
An author is either the current human membership author or an explicit Server-authored system
author: `system: "reminder"`, `"session"`, or `"task"`. System rows are never represented as a
human membership. Task creation and promotion use `system: "task"` for a concise informational
receipt in the parent Chat; the receipt is persisted as an ordinary `message.created` timeline
event and is recovered through the same cursor path as other messages.

Every attachment must be ready, uploaded by the author, unassociated, and in
the same Server and Chat. Message creation, attachment association, and the
`message.created` event commit in one PostgreSQL transaction. The normal
message refetch carries attachment metadata; no separate attachment event is
emitted. Messages have no update or delete procedure.

Regular Channels carry `archivedAt` and `archivedByUserId`. Archive preserves
the Channel and all history, hides it from `chat.list`, freezes writes to the
Channel and its child Threads, pauses anchored reminders, and deletes pending
Agent work whose run has not been accepted. `chat.listArchived`, `chat.get`,
message reads, and search keep archived history reachable. Unarchive clears the
archive fields and does not replay canceled work.

Delete first tombstones the regular Channel so access and writes fail closed,
then purges attachment objects and the Channel aggregate. Database dependents
cascade or are explicitly removed, including child Threads and reminders. A
durable `chat.lifecycle` event retains only the deleted Chat id and transition
metadata so clients can invalidate stale state. Startup retries any interrupted
tombstoned-Channel purge. `#all`, DMs, and Threads cannot use these lifecycle
procedures independently.

Hosted human chat includes hidden child Threads with parent-derived
authorization, per-human follows, reads, and parent unread rollup. It also owns
chat-first tasks whose identity is one canonical message and whose work surface
is that message's deterministic child Thread. Hosted reminders may author
scheduled system messages, but remain a separate schedule contract. Agents
author durable messages through the scoped runner surface below, never through
`chat.send`; `chat.send` stays human-only. Hosted human chat intentionally
excludes reactions and general delivery queues.

### Hosted attachments

The App reserves metadata through tRPC, then streams bytes directly to the
hosted Server:

```http
PUT /attachments/{serverId}/{attachmentId}
Authorization: Bearer <Clerk session>
Content-Type: application/octet-stream
```

The stream may omit `Content-Length`. When present it must be an exact
nonnegative byte count no larger than 50 MiB; the Server also enforces the
limit while streaming. Zero-byte attachments are valid. A partial,
overflowing, or conflicting attempt never becomes ready.

Authorized downloads use `GET` on the same URL. Responses include the stored
media type and length, attachment disposition with UTF-8 filename encoding,
`X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store`.
Message and list payloads carry only `{ id, filename, mediaType, sizeBytes }`;
they never carry file bytes or storage paths.

Client values never name filesystem paths. The Server resolves the authorized
PostgreSQL row first and derives fixed digest leaves beneath its private
attachment root. Attachments are neither `ChatArtifact` records nor Agent
workspace artifacts.

Hosted direct mention piercing is narrow: an explicit immutable
`[@Label](user://<grotto-user-id>)` reference to a parent participant contributes
that one unread reply to the parent badge after explicit unfollow. It does not
re-follow. Bare `@text` is inert; no parallel mention index is stored.

## Hosted Reminders

The reminder operator surface is typed tRPC backed directly by PostgreSQL:

| Procedure | Authority and contract |
| --- | --- |
| `reminder.list` | Owner/Admin filtered schedule snapshots; script content redacted |
| `reminder.runs` | Owner/Admin fire log for one reminder in the Server |
| `reminder.cancel` | Owner/Admin idempotent cancel with expected version |
| `reminder.changes` | Owner/Admin durable `reminder.changed` catch-up after a cursor |
| `reminder.onEvent` | Owner/Admin post-commit live change notification |

Agent-authored schedule/list/log/update/snooze/cancel operations are hosted
domain functions. Agent authentication, Computer delivery, execution, and
attention acknowledgment are later transport work, not hosted human APIs in
this slice.

Every fire transaction appends its visible system receipt before the paired
`reminder.changed` event, records the fire, and creates concrete
`reminder_agent_attention`. Script content is opaque and never returned by the
operator procedures or executed by the Server.

## Hosted Agent Execution

A managed Agent runs on its assigned Computer and speaks back through the
scoped runner surface. The boundary follows ADR 0019: the Server owns durable
collaboration and compact activity; the Computer owns isolated execution and
raw traces.

- **Typed delivery.** The Server sends a `start` command down the Computer's
  attachment socket (`{ type: 'start', agentId, chatId, runId, runtimeId,
  modelId, inbox }`). `inbox` contains structured Server-owned envelopes; the
  Computer owns their exact model projection. Hosted collaboration never waits
  on a Computer. The Server and Computer each admit one in-flight turn per
  Agent, while the parked AI SDK Harness session persists across deliveries.
- **Runner authority (least credentials).** Before spawning the Agent, the
  Computer mints a per-launch runner credential from its Computer credential:

  ```http
  POST /computer/runner/mint    { credentialHash, agentId, runId, chatId }
                                → { runnerId, runnerToken }
  POST /computer/runner/revoke  { credentialHash, runnerId }
  ```

  The runner credential is scoped to one Agent and run on one Server. The
  launch chat carries turn context; each Agent API action still resolves its
  product target and access Server-side. Only the credential hash is stored,
  and it is revoked when the turn ends. The Computer keeps it behind a
  resident per-Agent loopback proxy; the Agent receives only that host's stable
  local proxy token. The next turn rotates the Server-valid runner authority
  behind the same local boundary.

- **Agent output.** The embedded managed `grotto` wrapper is the Agent's only
  collaboration output channel. `grotto message send` reaches the Computer's
  loopback proxy with the local proxy token; the proxy forwards to the hosted
  Server with the runner credential:

  ```http
  POST /api/agent/messages/send   { target, content, nonce }
                                → { state: "sent", receipt }
  ```

  The runner credential fixes the author and Server, so the route trusts
  neither an agent id nor a chat id from the body. It resolves `target` and the
  Agent's membership Server-side, then writes one durable Agent-authored
  message. Sends are idempotent by `(chat, nonce)`. A missing, bogus, or revoked
  token fails closed with `401`.

- **Compact activity.** After a launch settles the Computer reports a `turn`
  summary over the attachment socket (`{ type: 'turn', agentId, runId, status,
  messageCount, summary, startedAt, endedAt }`), persisted to `agent_turns`
  keyed by run. Raw transcripts, logs, and workspace files stay Computer-local
  behind the authorized live relay and never enter Server storage. No provider,
  runner, or proxy secret enters Agent env, output, traces, or Server
  diagnostics.

## Local Runtime Contract (pre-cutover)

Grotto Runtime is the durable source for chat objects.

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
execution evidence linked to Grotto messages.

## Chats And Participants

A `chat` is a Runtime-owned conversation container. Grotto-owned chats use
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
retained as read-only history when their Agent is retired, and clients must not
expose chat deletion controls for them.
Development mode additionally seeds the `demo` channel.

`chat.participants` is the membership contract for the chat shell. Participant
rows use Grotto product ids such as `usr_...`, `agt_...`, and `sys_...`, plus
observed `external` participants for non-Grotto frontends. Agent session
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
as a single delivery. Idle and busy agents receive a content-free notice;
message bodies become visible only when the agent checks messages. See
[Agent Inbox](../../specs/inbox.md).

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
is scoped to that Grotto user and excludes messages authored by that user.
Keyless clients may omit it to use the synthetic `usr_tavern` operator.

## Grotto App Reads

The Grotto app keeps list and detail reads separate:

* `chat.list` returns ordered Grotto chat ids plus lightweight list items. It is
  the sidebar and overview contract, not a full chat detail payload. List items
  include `activeTurnParticipantIds` so compact views can show in-progress
  agent work without reading the full chat log. Channels and DMs are durable rooms in the
  app sidebar. External execution references belong to `agent.chats.list`, not
  the global Grotto chat list. Grotto chat list recency comes from
  `last_activity_at`; metadata-only edits must not make a chat look newly active.
* `chat.get` returns one full chat record by `chatId`.
* `chat.updateTabAppearance` changes the durable channel color metadata for a
  Grotto chat.
* `chat.updateSystemPrompt` changes trusted chat-specific agent instructions
  for a Grotto chat. Empty text clears the prompt.
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
mid-turn is a normal message send. Runtime caches the new message on the
Computer and attempts to inject a content-free notice into the running turn.
If that safe-boundary injection fails, the unchanged pending identity remains
eligible for a later notice (see [Agent Inbox](../../specs/inbox.md)). Model changes are Runtime session
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
approval policy. Grotto does not expose an approval response endpoint.

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
in metadata or source fields; never use it as the Grotto timeline cursor.

## Chat Instructions

Grotto chats can carry trusted chat-specific instructions in
`metadata.tavern.groupSystemPrompt`. Grotto passes that value through the
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
responses are authored by agents, but the Grotto noun stays chat-first: agent
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

Activity ids are global Grotto ids. Updating an activity id that belongs to a
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

Agent transcript sync upserts by stable Grotto ids when they are present.
Transcript rows without Grotto identity remain execution evidence. Grotto links
them through response and activity metadata when possible; they are not matched
to existing Grotto messages by content or timestamp.

## What Is Intentionally Missing

* Per-message edit or delete.
* Content/timestamp duplicate detection.
* Hidden chain-of-thought as message content or activity.
* Runtime session sequence as the Grotto timeline cursor.
* Agent transcript rows as canonical chat history.

## Related Docs

* [Realtime](realtime.md)
* [Data model](../internals/data-model.md)
* [Chat feature](../features/chat.md)
* [Grotto Runtime Chat Server](../../specs/runtime-chat-server.md)
* [Agent Engine Runtime](../internals/agent-engine-runtime.md)
