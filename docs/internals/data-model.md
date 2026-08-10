---
summary: Hosted PostgreSQL collaboration and reminders plus Runtime execution chat, app cache, FTS, and storage invariants.
read_when:
  - changing SQLite tables, ids, sync invariants, or runtime transcript storage
  - changing hosted PostgreSQL Chats, messages, reads, search, or event recovery
  - changing hosted task, assignment, task-label, or task-event storage
  - changing hosted reminder, Agent attention, or reminder-event storage
  - changing chat/session/message identity, event recovery, or sync semantics
---

# Data Model

Grotto Runtime is the always-on chat server.

Agents participate in Grotto chats as Runtime-owned chat participants. An agent
participant is an Agent seat, and the seat points at its current Agent session.
The engine owns model calls, tools, files, and native execution details. Grotto
Runtime owns chats, participants, Agent sessions, Agent turns, messages,
artifacts, sequence, events, reads, soft deletes, automations, inbox
delivery, and the product timeline.

## Source Files

| Layer                    | Source                                              | Role                                                                                        |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Runtime schema           | `apps/runtime/src/db/schema.ts`                     | Runtime SQLite schema and fresh setup                                                       |
| Runtime chat store       | `apps/runtime/src/tavern/chat-api/`                 | OpenAPI-backed chat, message, response, activity, artifact, delivery, read, and event store |
| Runtime delivery planner | `apps/runtime/src/tavern/delivery-planner.ts`       | Attention-rule delivery planning and agent wake (specs/inbox.md)                            |
| Runtime agent sessions   | `apps/runtime/src/tavern/agent-session-store.ts`    | Agent global session state and lazy model-switch rotation                                  |
| Runtime model profiles   | `apps/runtime/src/models/runtime-profile-store.ts`  | Per-agent default execution model for new Agent sessions                                     |
| Runtime chat tests       | `apps/runtime/src/tavern/chat-api-store.test.ts`    | Contract, identity, sequence, event, read, and route behavior                               |
| Runtime timeline tests   | `apps/runtime/src/tavern/chat-api-timeline.test.ts` | Turn-aligned history pages, cursor stability, and window alignment                          |
| App schema               | `apps/server/src/db/bootstrap.ts`                   | App SQLite fresh setup                                                                      |
| App Drizzle schema       | `apps/server/src/db/schema/`                        | Typed app cache and synced runtime tables                                                   |
| Hosted schema            | `apps/server/src/postgres/schema/`                  | Typed PostgreSQL collaboration, reminder, and durable-attention schema                       |
| Hosted migrations        | `apps/server/drizzle/postgres/`                     | Ordered, checked-in PostgreSQL migration SQL and snapshots                                   |
| Grotto API package       | `packages/tavern-api/src/`                          | OpenAPI-generated and Zod-backed API contracts                                              |
| Agent execution evidence | Runtime SQLite                                      | Native execution and transcripts                                                            |

## Store Boundaries

| Store                    | Owner                                      | Contents                                                                                                                          |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Runtime SQLite           | Grotto Runtime                             | Canonical chat model, automation delivery, agent seats, Agent sessions, inbox delivery cursors, cursor-backed events, read markers, runtime metadata |
| App SQLite               | Grotto App                                 | Client cache, app-shell preferences, and presentation state                                                                       |
| Agent execution evidence | Grotto Runtime                             | Sessions, turns, tools, model calls, transcripts, and files                                                                       |
| Hosted PostgreSQL        | Grotto Server                              | Users, Servers, memberships, Channels, DMs, Threads, messages, chat-first tasks, reminder schedules/fires/attention, reads, search, and durable collaboration events |

Runtime SQLite is the product source of truth for chat. App SQLite can cache for
fast UI, but reconnect and hard reload recover from Runtime history and cursors.
Agent transcripts are execution evidence linked to Grotto messages and stored
through Grotto Runtime.

## Hosted PostgreSQL Chat Tables

```text
chats
channel_participants
agents
channel_agent_participants
chat_messages
chat_reads
chat_events
thread_follows
message_tasks
task_labels
message_task_labels
server_invitations
server_onboarding
computer_login_grants
computer_login_sessions
computer_login_refresh_tokens
reminders
reminder_commands
reminder_fires
reminder_agent_attention
```

Every row carries `server_id`. Composite keys and foreign keys require related
Chats, memberships, messages, reads, and events to belong to that same Server.
`server_onboarding` is one row per fresh Server. It owns the mandatory setup
phase, selected first Computer, actionable failure code/detail, private
onboarding Channel id, and the one Cove Agent/application/runtime/model
reservation. Composite foreign keys keep its Computer, Channel, and Cove inside
the same Server; unique application and Channel ids make replay converge on the
same operation. Progress never derives from Agent count, a `cove` handle, route
state, or connection guesses; restart and reconnect recover the row directly.
The `complete` transition marks the factory applied and enqueues one pending
system attention under the application id. That attention has no Chat-message
row; Cove's runner creates the first canonical greeting. Completion remains
authoritative after failed turns, reset, or Cove deletion, so acknowledgement
replay cannot re-gate the App, recreate Cove, or enqueue another greeting.
Existing Servers are not migrated.
Computer login grants store hashed one-use device codes, short-code approval
state, expiry, the approving Clerk identity, and whether the grant is standalone
login or Computer setup. Consumed grants own one
origin-bound Computer login session whose access and refresh tokens are stored
only as hashes; the raw session is returned once to the CLI. Each session owns a
rotating refresh-token family: consumed tokens remain as history for reuse detection,
and family revocation marks the session and every family row revoked in one transaction.
`stored_at` records the CLI's post-persistence acknowledgement and gates the browser's
completed state.
Channels store participants in `channel_participants`; a DM stores its sorted
two-User pair and both membership stint numbers directly on `chats` and has no
duplicate participant rows. The pair plus both stints is unique. Visibility
matches the reader's current stint, so reinvitation opens a fresh DM without
granting the returning human its former DM or child-Thread history. The peer
whose stint did not change retains that preserved history.
Threads are `chats(kind = 'thread')` with deterministic identity, parent and
anchor pointers, their own sequence, and no participant rows. Composite
constraints bind the parent and anchor to the same Server and forbid a Thread
parent. `thread_follows` stores attention only; every access check resolves the
parent Chat.

Regular hosted Channels use nullable `archived_at`/`archived_by_user_id` and
`deleted_at`/`deleted_by_user_id` lifecycle pairs. Archived rows remain
canonical and readable but are absent from active lists; write authorization
inherits the parent Channel's archive state for child Threads. Delete uses the
row as a fail-closed tombstone while filesystem attachment objects are purged,
then explicitly removes reminder roots and child Threads before deleting the
parent. Foreign-key cascades own the remaining relational dependents. Startup
retries any tombstone left by an interrupted filesystem/database purge.
Lifecycle actor ids are audit facts rather than membership foreign keys, so a
later membership transition cannot block lifecycle history or cleanup.

`chats.last_message_sequence` is locked and incremented in the message
transaction. `chat_messages` is unique by `(server_id, chat_id, sequence)` and
by `(server_id, chat_id, nonce)`. Message and `message.created` event insertion
are atomic. Read advancement and its private `chat.read` event are atomic.
Archive/unarchive and their `chat.lifecycle` event are atomic. A deletion event
uses `lifecycle_chat_id`, not the live Chat foreign key, so it survives the
aggregate purge and lets connected clients discard stale cached state.
`chat_messages.search_vector` is a generated PostgreSQL `tsvector`; it is
derived search state queried through its GIN index, not a second message store.
`servers.last_chat_event_cursor` allocates commit-ordered event cursors while
the Server row is locked. `server_memberships.revoked_at` preserves historical
author and DM foreign keys while excluding the human from every current access
check.

`server_memberships` is unique by `(server_id, user_id)`, and six composite
foreign keys point at it from `chats` (both DM sides), `channel_participants`,
`chat_messages`, `chat_reads`, and `chat_events`. That row is the durable anchor
of authored history, so membership is revoked and re-accepted in place, never
deleted and re-inserted. `joined_at` stamps when the current stint began;
`stint` increments on reinvitation and is the authorization generation private
DM state records.

`server_invitations` stores only a token's SHA-256 hash, unique across the
table. A partial unique index on `(server_id, email)` where the invitation is
neither revoked nor accepted allows at most one live invitation per address.
Expiry cannot join that predicate — index predicates must be immutable and
`now()` is not — so issuing a fresh invitation first retires a lapsed one.
Acceptance locks the invitation row, so one token yields exactly one membership
under concurrency.

Membership changes and membership-authorized durable writes lock the `servers`
row before authorizing. That holds the last-Owner invariant and prevents a
removed human from committing a message, read, DM, task, or invitation write
after revocation.

`message_tasks` has one row per promoted canonical message. Composite
constraints bind its Server, parent Chat, message, human assignee, and task-label
links to the same tenant. The deterministic child Thread id is derived from the
canonical message id and authorized through its parent Chat.
`chats.last_task_number` is locked for monotonic per-Chat numbering.
`message_tasks.version` is the compare-and-write boundary for claim, unclaim,
assignment, status, priority, and label changes. Task content remains only in
`chat_messages`. Membership removal clears claims and assignments under the
same Server lock, advances each affected task version, and writes exact
`task.updated` events. A returning membership stint does not recover those
links or qualify for its former DM tasks.

`task_labels` is a Server-scoped task catalog, and `message_task_labels` is its
only join table. These tables do not form a generic taxonomy. Task mutations
write `task.created`, `task.updated`, or `task.label.updated` events in the
same transaction; task and label reads remain the recovery source.

Hosted Agent rows own immutable identity, the uploaded avatar they wear (`avatar_id`),
role, home timezone, retirement, immutable Computer assignment, Server-desired
runtime/model configuration, the Computer-reported effective snapshot, and
Channel participation. An Agent handle is a Server-scoped active alias: it is
case-insensitively unique only among non-retired Agents. A retired tombstone keeps
its historical handle, while a later Agent may reuse the alias under a new Agent
id. Computer credentials, execution transport, and turn evidence remain separate
records.

`avatars` holds the bytes of one uploaded square image, keyed by an opaque
`avt_` id. Agents and Users point at it through a nullable `avatar_id`;
replacing an avatar writes a fresh row and deletes the one it replaced, so an
avatar only exists while something wears it. Ids are opaque and the bytes are
immutable, so `/api/avatars/:avatarId` serves them unauthenticated with a
one-year immutable cache.

`reminders` owns the current schedule and anchor. `reminder_commands` makes
schedule/update/snooze/cancel retries idempotent per actor and command id,
including the original result snapshot.
`reminder_fires` is unique by `(server_id, reminder_id, scheduled_for)`.
`reminder_agent_attention` is unique per fire and snapshots the receipt plus an
optional opaque script for the owning Agent. Direct and composite foreign keys
keep every reminder noun in one Server. There is no generic job or outbox
table, and attention has no acknowledgment protocol in this slice.

The logical fire transaction locks a due reminder, allocates the Chat sequence
and Server event cursors, appends the reminder system message, inserts the fire
and attention rows, advances or completes the schedule, then appends
`message.created` followed by `reminder.changed`. A recurring overdue reminder
advances from the current controlled clock, so restart recovery fires at most
one missed slot.

Fresh databases are created entirely by the checked-in Drizzle migration
history. Production deployment migrates before activating the new Server
release; migrations must therefore remain compatible with the previous release
so application rollback remains safe.

Hosted parent unread count is top-level unread plus unread replies by others in
followed Threads. For an explicitly unfollowed Thread, only an unread explicit
`user://` reference to the reader contributes, once, without changing the
follow row. Thread reads use the ordinary per-Chat `chat_reads` high-water mark.

The channel relay writes durable chat records and dispatches through the
agent's current global Agent session. It does not keep a private outbox,
duplicate message history, or invent chat metadata.

## IDs

Use wiki prefixes at the Grotto API boundary.

| Prefix | Entity             |
| ------ | ------------------ |
| `cht_` | chat               |
| `msg_` | message            |
| `rsp_` | response           |
| `act_` | response activity  |
| `art_` | artifact           |
| `usr_` | user participant   |
| `agt_` | agent participant  |
| `sys_` | system participant |
| `ags_` | Agent session      |
| `evt_` | event              |
| `del_` | delivery           |
| `rt_`  | runtime connection |

Read markers are scoped records, not standalone product ids.
Engine ids and runtime agent ids remain source ids. Store them in runtime
metadata or source fields, not as Grotto product ids unless Grotto minted them.

## Runtime Chat Tables

```text
chats
chat_participants
thread_follows
chat_messages
chat_responses
chat_response_activity
chat_artifacts
chat_deliveries
chat_events
chat_reads
agent_inbox_cursors
agent_channel_mutes
agent_inbox_pierces
agent_session_served_cursors
```

These tables live in Runtime SQLite and back the OpenAPI chat contract.
Runtime derives `chat.last_activity_at` from the latest undeleted
`chat_messages.created_at`; `chats.updated_at` remains metadata/container
update time.

`chat_responses`, `chat_response_activity`, and `chat_deliveries` remain real,
schema-backed tables — agents no longer write through them for live
execution (ADR 0014: agents write reply messages themselves via
`grotto message send`, and `agent_turns` is the durable execution record).
They stay wired for seeded chat demos and external clients. `agent_inbox_*`
and `agent_session_served_cursors` are the current delivery/freshness ledger
(specs/inbox.md), replacing the retired `agent_session_chat_cursors` /
`agent_served_chat_cursors` per-chat model.

Agent sessions also live in Runtime SQLite. They are execution routing state,
not chat history.

Agent turns also live in Runtime SQLite. They are durable execution state linked
to messages and responses, while active stream state remains in Runtime memory.

Agent configuration rows also live in Runtime SQLite. They are agent-level
product settings, not chat/session state.

```text
agents
  id                     TEXT PRIMARY KEY
  name                   TEXT NOT NULL
  avatar_url             TEXT                 -- data: URL, null falls back to initials
  primary_color          TEXT
  workspace_folder       TEXT NOT NULL
  enabled_skill_ids_json TEXT NOT NULL DEFAULT '[]' -- compatibility snapshot
  is_admin               INTEGER NOT NULL DEFAULT 0
  raw_json               TEXT NOT NULL
  last_synced_at         TEXT NOT NULL
  created_at             TEXT NOT NULL
  updated_at             TEXT NOT NULL

agent_skill_assignments
  agent_id               TEXT NOT NULL
  skill_id               TEXT NOT NULL
  enabled                INTEGER NOT NULL DEFAULT 1
  created_at             TEXT NOT NULL
  updated_at             TEXT NOT NULL

agent_mcp_tool_grants
  agent_id               TEXT NOT NULL
  connection_id          TEXT NOT NULL
  tool_name              TEXT NOT NULL
  created_at             TEXT NOT NULL
  updated_at             TEXT NOT NULL

agent_host_tool_grants
  agent_id               TEXT NOT NULL
  tool_id                TEXT NOT NULL
  created_at             TEXT NOT NULL
  updated_at             TEXT NOT NULL
```

Rules:

- `agent_skill_assignments` is the canonical per-agent skill assignment table.
- `agent_mcp_tool_grants` is the canonical exact grant for connection tools.
- `agent_host_tool_grants` stores Browser and `web_fetch` access.
- `agents.enabled_skill_ids_json` remains only as a compatibility snapshot for
  existing records and sync payloads.
- `agents.avatar_url` holds the agent's uploaded square avatar inline as a
  `data:` URL. The local app is single-user, so there is no local avatar blob
  table; a null column means surfaces render initials.
- Harness tools are executor facts and do not have agent grant rows.

Agent runtime profiles also live in Runtime SQLite. They are per-agent
execution defaults for new Agent sessions, not agent identity fields.

```text
agent_runtime_profiles
  agent_id              TEXT PRIMARY KEY
  default_model_json    TEXT NOT NULL
  sandbox_mode          TEXT NOT NULL        -- none, docker, podman
  created_at            TEXT NOT NULL
  updated_at            TEXT NOT NULL

agent_model_selections
  agent_id              TEXT PRIMARY KEY
  provider_id           TEXT NOT NULL
  model_id              TEXT NOT NULL
  status                TEXT NOT NULL        -- unknown, valid, invalid
  invalid_reason        TEXT
  last_validated_at     TEXT
  updated_at            TEXT NOT NULL
```

Rules:

- One row exists at most per Runtime agent.
- Missing runtime profiles resolve to Runtime provider defaults.
- `agents.raw_json` does not store model choices.
- Catalog rows are read inventory.
- `agent_runtime_profiles.default_model_json` sets the model for future Agent
  sessions.
- `agent_sessions.effective_model_json` is the model actually used by that
  session.
- The app changes the model for the current Grotto Agent seat by writing the
  current Agent session model, not by mutating app-local settings.

## `chats`

Durable conversation containers.

```text
chats
  id                    TEXT PRIMARY KEY
  kind                  TEXT NOT NULL        -- channel, dm, task, thread
  title                 TEXT
  parent_chat_id        TEXT                 -- non-null for threads
  anchor_message_id     TEXT                 -- non-null for threads
  pinned                INTEGER NOT NULL DEFAULT 0  -- legacy Runtime field; Grotto App ignores it
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  created_at            TEXT NOT NULL
  updated_at            TEXT NOT NULL
  last_message_sequence INTEGER NOT NULL DEFAULT 0
```

Indexes:

```text
PRIMARY KEY(id)
```

Rules:

- Runtime does not bootstrap user channels for a normal workspace.
- Development mode seeds `cht_demo` as `kind: channel`, display name `demo`,
  and a seeded channel color.
- Each Runtime-managed agent has one built-in DM with the local human operator.
- A DM has exactly two participants: the local human operator and one agent.
- Dispatched tasks use `kind: task` and keep the local human plus the assigned
  agent participants in the task's reusable work chat.
- Threads have deterministic ids, their own message sequence, and
  parent-derived access. Their display name is derived at read time.
- Chat archival and presentation state currently live in `metadata_json`.

## `thread_follows`

Per-participant attention state for thread chats.

```text
thread_follows
  thread_chat_id TEXT NOT NULL
  participant_id TEXT NOT NULL
  followed       INTEGER NOT NULL DEFAULT 1
  created_at     TEXT NOT NULL
  PRIMARY KEY(thread_chat_id, participant_id)
```

Posting, anchor authorship, and a first parent-participant mention auto-follow a
thread. An explicit unfollow keeps its row with `followed = 0` so later mentions
pierce without re-following; posting reactivates the follow. Followed-thread
unread messages roll into the parent chat count.

## `chat_participants`

Actors that can author messages or receive private events.

```text
chat_participants
  chat_id        TEXT NOT NULL
  id             TEXT NOT NULL
  kind           TEXT NOT NULL        -- user, agent, system, external, plugin
  label          TEXT
  metadata_json  TEXT NOT NULL DEFAULT '{}'
```

Indexes:

```text
PRIMARY KEY(chat_id, id)
```

Do not merge participants by display name. Participant labels are source
provenance, not person identity assertions.

## `chat_messages`

Durable chat rows ordered by per-chat sequence.

```text
chat_messages
  id                    TEXT PRIMARY KEY
  chat_id               TEXT NOT NULL
  sequence              INTEGER NOT NULL
  author_participant_id TEXT NOT NULL
  status                TEXT NOT NULL        -- accepted, delivered, failed, deleted
  content               TEXT NOT NULL
  attachment_json       TEXT
  nonce                 TEXT
  source                TEXT NOT NULL        -- tavern, agent-engine, automation, system
  request_id            TEXT
  delivery_id           TEXT
  run_id                TEXT
  agent_session_id      TEXT
  engine_session_id     TEXT
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  created_at            TEXT NOT NULL
  updated_at            TEXT NOT NULL
  deleted_at            TEXT
```

Indexes and uniqueness:

```text
UNIQUE(chat_id, sequence)
UNIQUE(chat_id, nonce) WHERE nonce IS NOT NULL
idx_chat_messages_chat_sequence(chat_id, sequence)
idx_chat_messages_author(author_participant_id)
idx_chat_messages_delivery(delivery_id)
idx_chat_messages_run(run_id)
idx_chat_messages_agent_session(agent_session_id)
```

Rules:

- Message creation is durable before model work starts.
- A durable message never starts a turn directly. Inbox delivery planning
  queues it per attention rules for every joined/following agent regardless
  of mentions, and an idle agent's next drain turn picks it up
  (specs/inbox.md).
- An agent DM addresses its one agent participant implicitly.
- Sequence is assigned in the message insert transaction.
- Duplicate `message.id` returns the existing message.
- Duplicate `(chat_id, nonce)` returns the existing message.
- Content, timestamp, and display text are never duplicate keys.
- Per-message edit and delete APIs do not exist. Chat clear may set
  `deleted_at` while preserving rows and sequence slots.

Message body fields are rendered content only. `content` stores the durable text
body. `attachment_json` stores the durable attachment array for the message.
Hidden chain-of-thought is never message body content. Provider-exposed
thinking summaries, tool calls, tool results, assistant progress, and status
rows are response activity.

## `chat_responses`

Durable participant responses to chat messages.

```text
chat_responses
  id                       TEXT PRIMARY KEY
  chat_id                  TEXT NOT NULL
  participant_id           TEXT NOT NULL
  request_message_id       TEXT
  response_message_id      TEXT
  status                   TEXT NOT NULL        -- queued, running, completed, failed, cancelled
  summary                  TEXT
  metadata_json            TEXT NOT NULL DEFAULT '{}'
  created_at               TEXT NOT NULL
  updated_at               TEXT NOT NULL
  completed_at             TEXT
  deleted_at               TEXT
```

Indexes:

```text
idx_chat_responses_chat_created(chat_id, created_at, id)
idx_chat_responses_chat_updated(chat_id, updated_at, id)
```

Rules:

- A response is the chat product record for one participant's attempt to answer
  or act on a message.
- Runtime, session, run, and turn ids remain metadata on the response.
- `created_at` defines stable response pagination. `updated_at` changes when
  activity or final state changes.
- Running responses are durable and recoverable after reload.
- Completion or failure updates the same response row.
- Soft delete sets `deleted_at` and keeps the row; activity and artifacts
  follow their response out of the timeline. Dismissal and chat clear use it.

## `agent_turns`

Durable, floating execution records (ADR 0014). A turn anchors to the
agent's global session, never a chat or a triggering message — inbox
delivery decides what content the agent sees; the turn record just tracks
that an execution happened.

```text
agent_turns
  id                 TEXT PRIMARY KEY        -- run_...
  agent_id           TEXT NOT NULL
  agent_session_id   TEXT NOT NULL
  kind               TEXT NOT NULL           -- start, drain
  status             TEXT NOT NULL           -- queued, running, completed, failed, cancelled
  metadata_json      TEXT NOT NULL DEFAULT '{}'
  created_at         TEXT NOT NULL
  updated_at         TEXT NOT NULL
  started_at         TEXT
  completed_at       TEXT
```

Indexes:

```text
idx_agent_turns_session_status(agent_session_id, status, created_at)
idx_agent_turns_agent_created(agent_id, created_at)
```

Rules:

- A turn is owned by one Agent session. `kind: start` is the bare `Start.`
  turn a fresh session gets first; `kind: drain` delivers one or more
  pending inbox targets as batched envelopes.
- An agent has at most one running/queued turn per session at a time; the
  agent activity feed and presence project from this table
  (specs/agent-activity.md, specs/presence.md).
- Prompt evidence and errors ride `metadata_json`; file-change evidence is
  `agent_turn_file_changes`, keyed by this table's `id` as `run_id`.
- Active streaming and cancellation handles are transient Runtime memory, not
  chat history.
- Stop transitions a queued or running turn to `cancelled` — agent-scoped,
  not tied to any one chat.

## `agent_turn_file_changes`

Per-turn workspace file-change evidence: the files a turn created, modified,
or deleted in the agent workspace, with bounded before/after text for diff
rendering.

```text
agent_turn_file_changes
  run_id      TEXT NOT NULL
  path        TEXT NOT NULL
  change      TEXT NOT NULL        -- created, modified, deleted
  before_text TEXT
  after_text  TEXT
  omitted     TEXT                 -- NULL, binary, too-large
  before_size INTEGER
  after_size  INTEGER
  additions   INTEGER NOT NULL DEFAULT 0
  deletions   INTEGER NOT NULL DEFAULT 0
  created_at  TEXT NOT NULL
  PRIMARY KEY (run_id, path)
```

Rules:

- Runtime captures a bounded workspace snapshot before a turn executes and
  compares it when the turn settles; the diff fills these rows. Snapshots skip
  hidden names, skipped directories, and secret-shaped files with the same
  visibility rules as workspace browsing, plus engine-managed plumbing files
  (the harness CLI tool-relay shim) that are rewritten around turns and are
  not agent work.
- A turn with changes also records one `workspace_changes` tool activity row
  carrying the summary (paths and line counts); before/after text stays here
  and is served on demand at `GET /api/turns/{run_id}/file-changes`.
- Text is retained up to a per-file cap; binary or oversized files persist as
  changed rows with `omitted` set and no content. The turn's
  `metadata.fileEvidence` marker records `capturedAt` and whether the change
  set was truncated.

## `chat_response_activity`

Ordered durable work rows inside a response.

```text
chat_response_activity
  id                       TEXT PRIMARY KEY
  response_id              TEXT NOT NULL
  chat_id                  TEXT NOT NULL
  sequence                 INTEGER NOT NULL
  kind                     TEXT NOT NULL        -- reasoning, tool_call, tool_result, command, message, artifact, widget, custom
  status                   TEXT NOT NULL        -- queued, running, completed, failed, cancelled
  title                    TEXT NOT NULL
  detail                   TEXT
  summary                  TEXT
  artifact_ids_json        TEXT NOT NULL DEFAULT '[]'
  metadata_json            TEXT NOT NULL DEFAULT '{}'
  started_at               TEXT NOT NULL
  updated_at               TEXT NOT NULL
  completed_at             TEXT
```

Indexes and uniqueness:

```text
UNIQUE(response_id, sequence)
idx_chat_response_activity_response_sequence(response_id, sequence)
idx_chat_response_activity_chat_sequence(chat_id, sequence)
```

Rules:

- Activity rows are statusful and updated in place as work progresses.
- Activity ids are global and cannot move between chats or responses.
- Tool calls, tool results, thinking summaries, plans, and message
  references are activity.
- Runtime tool ids, tool names, arguments, results, and source facts live in
  `metadata_json`.
- Reload recovery reads the same activity rows for running and completed
  responses.
- Hidden chain-of-thought is never stored here.

## `chat_artifacts`

Durable renderable outputs attached to a message, response, or activity row.

```text
chat_artifacts
  id                       TEXT PRIMARY KEY
  chat_id                  TEXT NOT NULL
  response_id              TEXT
  activity_id              TEXT
  message_id               TEXT
  kind                     TEXT NOT NULL        -- code, image, file, diff, document, chart, text, custom
  title                    TEXT
  content_text             TEXT
  content_ref              TEXT
  mime_type                TEXT
  metadata_json            TEXT NOT NULL DEFAULT '{}'
  created_at               TEXT NOT NULL
  updated_at               TEXT NOT NULL
```

Indexes:

```text
idx_chat_artifacts_chat_updated(chat_id, updated_at, id)
```

Rules:

- Artifacts are renderable outputs, not tool calls by themselves.
- Code blocks, screenshots, generated images, files, diffs, documents, and
  charts are artifacts.
- Tool activity may reference artifacts it produced.

## `chat_events`

Recoverable notifications inserted with the mutation they describe.

```text
chat_events
  cursor                INTEGER PRIMARY KEY
  id                    TEXT NOT NULL UNIQUE
  event_type            TEXT NOT NULL
  chat_id               TEXT NOT NULL
  event_json            TEXT NOT NULL
  created_at            TEXT NOT NULL
  is_private            INTEGER NOT NULL DEFAULT 0
  recipients_json       TEXT NOT NULL DEFAULT '[]'
```

Indexes and uniqueness:

```text
idx_chat_events_chat_cursor(chat_id, cursor)
```

Rules:

- Insert durable events in the same transaction as the mutation.
- Cursor is monotonic inside Runtime SQLite.
- Websocket delivery is best-effort.
- Clients recover by asking for events after a cursor or by reading the durable
  resource.
- Large state lives in tables, not event payloads.

## `chat_reads`

Per-reader read pointers.

```text
chat_reads
  chat_id               TEXT NOT NULL
  reader_id             TEXT NOT NULL
  last_read_sequence    INTEGER NOT NULL
  read_at               TEXT NOT NULL
  cursor                INTEGER NOT NULL
```

Indexes and uniqueness:

```text
PRIMARY KEY(chat_id, reader_id)
```

Rules:

- Reads are monotonic per `(chat_id, reader_id)`.
- The server caps `last_read_sequence` to the chat's current last sequence.
- Read events are private to the reader.

## `chat_deliveries`

Assistant delivery receipts.

```text
chat_deliveries
  id                    TEXT PRIMARY KEY
  chat_id               TEXT NOT NULL
  agent_id              TEXT NOT NULL
  turn_id               TEXT
  message_id            TEXT NOT NULL
  cursor                INTEGER NOT NULL
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  created_at            TEXT NOT NULL
```

Duplicate `delivery.id` returns the existing delivery receipt. Duplicate
assistant `message.id` links the delivery to the existing durable message
instead of creating another message row.

## `agent_sessions`

One global execution context per agent (ADR 0011, `specs/sessions.md`).
Chats, threads, and tasks are routing surfaces, never session boundaries: the
same session backs every chat the agent sits in. Session ids follow
`ags_<agentId>_<generation>`.

```text
agent_sessions
  id                     TEXT PRIMARY KEY
  agent_id               TEXT NOT NULL
  generation             INTEGER NOT NULL
  effective_model_json   TEXT NOT NULL
  runtime_session_id     TEXT
  resume_state_json      TEXT
  instructions_hash      TEXT
  status                 TEXT NOT NULL        -- active, archived, stopped
  created_at             TEXT NOT NULL
  updated_at             TEXT NOT NULL
  archived_at            TEXT
  last_turn_at           TEXT
```

Rules:

- An agent has at most one `active` session; the current session is the
  active row, not a participant pointer.
- Sessions never rotate on a schedule. A fresh session starts only on a
  model switch (lazy rotation at the next turn when the active session's
  `effective_model_json` no longer matches the agent's configured model), a
  manual reset from agent settings, or after ~7 fully idle days
  (`last_turn_at`).
- Starting a new session archives previous active sessions for that agent.
- Sessions are archived, never deleted.

Uniqueness:

```text
UNIQUE(agent_id, generation)
```

## `agent_inbox_cursors`

The two-cursor ledger (specs/inbox.md): one durable row per `(session,
chat)` tracking what the inbox has queued (`delivered`) versus what is
provably model-visible (`seen`). `delivered` is transport state — muted
targets never advance it. `seen` is the sole model-seen authority for
freshness holds and catch-up: prompt-embedded envelopes advance it at turn
settle, pull outputs advance it when the tool result commits, hold catch-up
rows advance it when shown. Notices and wakes advance neither.

```text
agent_inbox_cursors
  session_id           TEXT NOT NULL
  chat_id              TEXT NOT NULL
  delivered_up_to_seq  INTEGER NOT NULL DEFAULT 0
  seen_up_to_seq       INTEGER NOT NULL DEFAULT 0
  updated_at           TEXT NOT NULL
  PRIMARY KEY (session_id, chat_id)
```

## `agent_channel_mutes` And `agent_inbox_pierces`

Agent-owned attention state. A channel mute suppresses ordinary delivery
from that channel and its threads without leaving; a personal @mention
pierces a mute or an unfollowed thread as a single message that does not
re-follow and never advances the muted target's `delivered` cursor.

```text
agent_channel_mutes
  agent_id   TEXT NOT NULL
  chat_id    TEXT NOT NULL
  created_at TEXT NOT NULL
  PRIMARY KEY (agent_id, chat_id)

agent_inbox_pierces
  session_id TEXT NOT NULL
  chat_id    TEXT NOT NULL
  message_id TEXT NOT NULL
  created_at TEXT NOT NULL
  PRIMARY KEY (session_id, chat_id, message_id)
```

## `agent_session_served_cursors`

Server-served pull horizon per `(session, chat)`, session-scoped like the
seen ledger. Pulls (`grotto message check`) advance it immediately so a
pull-then-send never spuriously holds. It supplements freshness-hold
decisions only and never replaces `seen` for catch-up or re-delivery; a
turn that pulled and died leaves `served > seen`, and catch-up re-delivers
from `seen` (duplicate envelopes after crashes are by design).

```text
agent_session_served_cursors
  session_id        TEXT NOT NULL
  chat_id           TEXT NOT NULL
  served_up_to_seq  INTEGER NOT NULL DEFAULT 0
  updated_at        TEXT NOT NULL
  PRIMARY KEY (session_id, chat_id)
```

## `agent_message_drafts`

At most one freshness-held draft per `(agent, chat)`. Reads lazily delete rows
whose `saved_at` is at least ten minutes old. A plain send replaces the row;
commit clears it.

```text
agent_message_drafts
  agent_id            TEXT NOT NULL
  chat_id              TEXT NOT NULL
  content              TEXT NOT NULL
  attachment_ids_json  TEXT NOT NULL DEFAULT '[]'
  rehold_count         INTEGER NOT NULL DEFAULT 0
  saved_at             TEXT NOT NULL
  PRIMARY KEY (agent_id, chat_id)
```

## Transaction Rules

Message create:

1. Open `BEGIN IMMEDIATE`.
2. Resolve duplicate `message.id` or `(chat_id, nonce)`.
3. Assign `sequence = MAX(sequence) + 1` for the chat.
4. Insert `chat_messages`.
5. Insert `chat_events(message.created)` with the same sequence.
6. Commit.

Assistant delivery:

1. Open `BEGIN IMMEDIATE`.
2. Resolve duplicate `delivery.id`.
3. Insert `chat_deliveries`.
4. Create or link the assistant `chat_messages` row when final text exists.
5. Insert `chat_events(message.delivered)`.
6. Commit.

Activity update:

1. Open `BEGIN IMMEDIATE`.
2. Resolve or create `chat_responses`.
3. Upsert `chat_response_activity` by stable activity or runtime tool id.
4. Upsert any referenced `chat_artifacts`.
5. Insert `chat_events(response.*|activity.*|artifact.*)`.
6. Commit.

Read update:

1. Open `BEGIN IMMEDIATE`.
2. Cap the requested sequence to the chat's last sequence.
3. Upsert `chat_reads` only when the new sequence is greater.
4. Insert private `chat_events(chat.read)`.
5. Commit.

## App Cache And Evidence

App tables are cache, presentation, or execution evidence:

| Current table           | Runtime role                                             |
| ----------------------- | -------------------------------------------------------- |
| `session_runs`          | runtime session/turn evidence linked to `chat_responses` |
| `session_messages`      | `runtime_transcript_messages` evidence                   |
| `session_message_parts` | transcript evidence and candidate `chat_artifacts`       |
| `session_tool_calls`    | tool evidence linked to `chat_response_activity`         |
| `session_artifacts`     | candidate `chat_artifacts`                               |
| `session_deliveries`    | `chat_deliveries` or runtime delivery evidence           |

The first task tracker (`tasks`, `labels`, `task_dependencies`, `task_labels`,
`task_attachments`) and the cron automation tables (`cron_jobs`, `cron_runs`)
were retired with ADR 0014; their schema rows remain but no route or app
surface reads or writes them. Chat-first tasks return with the tasks
workstream.

## FTS

Search has first-class indexing for chat messages. SQLite FTS mirrors durable
text fields through triggers or explicit transactional writes. Search indexes
are derived state, not the source of truth.

## Invariants

- Hosted human collaboration remains available with every Computer offline.
- Hosted actor and reader ids come from verified Clerk identity plus current
  Server membership, never browser authority.
- Hosted durable events notify; cursor catch-up and exact query refetch recover.
- Hosted reminder schedules, fires, receipts, and Agent attention remain
  available with every Computer offline.
- Hosted script payloads are opaque Computer execution data; the Server never
  interprets or executes them.
- Hosted Threads are hidden child Chats with parent-derived authorization and
  parent unread rollup.
- Hosted composition events are volatile and never persisted or replayed.
- Grotto Runtime chat history is canonical product state.
- Channels and DMs are durable chat rooms; Grotto App does not model pinned
  chats.
- The agent Chat participant is the stable Agent seat for an agent in a Chat.
- Agent sessions are agent-global; a reset or model switch starts a new
  session without changing any Agent seat.
- Agent transcript history is runtime-owned execution evidence.
- Runtime adapters preserve source ids and metadata without authoring final
  Grotto presentation.
- Reconciliation uses ids, nonces, sequences, delivery ids, Agent session ids,
  and run ids.
- Reconciliation never uses content/timestamp duplicate detection.
- Events notify; runtime durable reads recover.
- App-local progress hints never become a second chat history.

## Related Docs

- [API overview](../api/overview.md)
- [Chat API](../api/chat.md)
- [Realtime](../api/realtime.md)
- [Grotto Runtime](runtime.md)
- [Architecture overview](architecture-overview.md)
- [Grotto Runtime Chat Server](../../specs/runtime-chat-server.md)
- [Agent Inbox](../../specs/inbox.md)
