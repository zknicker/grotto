---
summary: Realtime contract for durable hosted chat/reminder events, tRPC invalidation, composition, and reconnect recovery.
read_when:
  - changing websocket subscriptions or reconnect behavior
  - adding a durable event type or a new tRPC invalidation event
  - changing the composition stream, presence, or realtime recovery semantics
---

# Realtime

Realtime is notification plus recovery.

PostgreSQL is the source of truth for hosted Server collaboration. Runtime
SQLite remains the pre-cutover source for local execution chat. WebSocket
delivery is allowed to drop; clients recover through durable reads.

## Components

| Component | Owner | Role |
| --- | --- | --- |
| Hosted `chat_events` | Grotto Server | PostgreSQL cursor log for messages, reads, follows, and reminder changes |
| Hosted durable subscription | Grotto Server | Live notification after commit; membership rechecked at delivery |
| Hosted composition hub | Grotto Server | In-memory, membership-checked, no persistence or replay |
| Hosted Agent lifecycle hub | Grotto Server | Volatile working/reading/sending/settled projection for presence and send composition |
| `chat_events` | Grotto Runtime | Durable cursor-backed event log |
| `chat_responses` / `chat_response_activity` | Grotto Runtime | Durable response/activity rows (real agent turns no longer populate them — see [Chat API](chat.md)) |
| `chat_artifacts` | Grotto Runtime | Durable renderable outputs |
| Event list | Grotto Runtime | Inspectable recent events derived from `chat_events` |
| App websocket | Grotto App | UI invalidation and client notifications (`agent.updated`, `chat.updated`, `chat.log.updated`, `model.updated`, `server.updated`, `session.updated`, `skill.updated`, `pane.updated`, `agent-runtime.updated`, `agent-runtime-capability.updated`, `engine-restart.updated`, and similar) |

`server.updated` is Server-scoped: `server.onUpdate` takes a Server id, checks
membership before the subscription starts, and delivers only that Server's
events. See [Grotto Server](../internals/grotto-server.md).

App websocket events are not the durable event source. They can mirror Runtime
events, but missed app notifications recover through Grotto API reads.

The event list does not own a second event log. App notifications are derived
from durable `chat_events`.

## Hosted Server Realtime

`chat.send`, an advancing `chat.markRead`, `thread.setFollow`, task mutations,
and reminder mutations insert their durable event in the same PostgreSQL
transaction as the owned row. `chat.events` lists accessible
events after a cursor in ascending order. `chat.onEvent` does not replay; it
notifies the App after commit. On subscription start or reconnect, the App
seeds a new in-memory cursor from `chat.eventHead` and refetches the Server Chat
snapshot, or walks `chat.events` from its last cursor with a private catch-up
cursor. Live delivery can advance in parallel without skipping the catch-up
window. Thread events carry the child Chat id and nullable parent Chat id.
Message events invalidate the exact message query, its parent summary when
present, the Chat list, and Server search; read/follow events invalidate the
parent summary and Chat list. `task.created` and `task.updated` invalidate the
Server task list and affected parent-Chat message snapshot.
`task.label.updated` invalidates the task-label catalog and task list.
`chat.lifecycle` carries `archived`, `unarchived`, or `deleted` plus the stable
Chat id. It invalidates active and archived lists, the focused Chat query,
search, messages, and tasks. Unlike ordinary Chat events, its id is retained
outside the live Chat foreign key so a delete notification survives the purge.

The Server row owns the next durable cursor. Event transactions increment that
counter while holding the Server row lock, then insert `chat_events` before
commit. Therefore a visible higher cursor can never precede an uncommitted
lower cursor, including mutations in different Chats.

Durable event payloads stay small: Server id, Chat id, event id, cursor,
sequence, timestamp, nullable parent Chat id, and the message id when
applicable. Message bodies, anchors, and read models come from focused queries.

Every subscription is checked at registration and again before each delivery.
Read events are visible only to their reader. Cross-Server events are neither
listed nor delivered. A durable notification for a Chat the subscriber cannot
open is skipped without terminating the Server feed; loss of Server membership
fails the subscription.

Hosted composition events use a separate in-memory hub. They carry current
composition text or a clear signal, are never written to PostgreSQL, have no
cursor, and are never replayed. The subscriber's Chat access is rechecked for
every delivery.

Hosted Agent lifecycle events are also volatile and membership-checked. The
Server projects `working` when a run is dispatched, `reading` when Computer
acceptance arrives and after a send commits, `sending` around the Agent's
message-send request, and `settled` from the Computer's terminal turn proof.
The App maps every active phase to coarse Agent `working` availability. Only
`sending` carries provisional text and composition identity, and only the
exact target Chat renders it. Settlement invalidates the durable Agent list,
delivery state, and activity reads. Reconnect recovers from those reads rather
than replaying lifecycle events.

Hosted durable event kinds are `message.created`, `chat.read`, `chat.lifecycle`, the
reader-private `thread.follow.updated`, `task.created`, `task.updated`, and
`task.label.updated`, plus `reminder.changed`.

Reminder scheduling, update, snooze, cancel, and fire append
`reminder.changed` to the same per-Server cursor. A fire appends
`message.created` first in the same transaction, so the canonical receipt is
durable before its reminder invalidation. `reminder.changes` walks only those
events after a cursor; `reminder.onEvent` is live-only. Owner/Admin authority
is checked for catch-up, subscription start, and every live delivery.

The Reminders hook owns this subscription and its exact list/run
invalidations. On start or reconnect it merges durable catch-up with live
delivery using a monotonic in-memory cursor, so a newer live event cannot be
overwritten by an older catch-up page.

## Endpoints

```http
GET /api/events?recipient_id=&limit=
GET /api/events/ws?recipient_id=
```

`GET /api/events` returns recent durable events ordered by cursor ascending. The
server clamps `limit`.

`GET /api/events/ws` upgrades to a WebSocket and streams live notifications
until disconnect. It does not backfill missed events.

Private events are delivered only when `recipient_id` matches an event
recipient. Without a matching `recipient_id`, event list and websocket delivery
include public events only.

## Event Shape

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

Events carry stable identity and enough cursor data to reconcile or refetch.
Large records live in resource reads, not event payloads.

## Durable Events

Durable events are inserted in the same Runtime transaction as the mutation they
describe.

Chat events:

* `message.created`
* `message.delivered`
* `message.updated`
* `response.created`
* `response.updated`
* `response.completed`
* `response.failed`
* `activity.created`
* `activity.updated`
* `activity.completed`
* `activity.failed`
* `artifact.created`
* `chat.read`

Automation, skill, and stats events use the same durable event log when they
affect client-visible Runtime state.

These chat-level events (`message.*`, `response.*`, `activity.*`,
`artifact.created`) are separate from the tRPC invalidation events the app
websocket carries (`agent.updated`, `chat.updated`, `session.updated`, and so
on) — see [Components](#components). Live in-chat turn progress does not ride
this event log: the chat timeline carries durable messages only, and
execution evidence surfaces on the agent profile instead (see
[chat-timeline](../../specs/chat-timeline.md) and
[agent-activity](../../specs/agent-activity.md)).

Read events are private to the reader. Private events use `private` plus
`recipients`, and Runtime filters them during event list and websocket delivery.

## Ephemeral Notifications

Ephemeral notifications are best-effort presentation hints. They can be dropped
under load and are not replayed after disconnect.

Examples:

* the ephemeral composition stream (`agent.composition` events) — a
  provisional bubble for an in-flight `grotto message send`, never persisted
  or replayed (see [Agent Inbox](../../specs/inbox.md))
* hosted Agent lifecycle (`working`, `reading`, `sending`, `settled`) projected
  to coarse busy/idle presence
* short-lived hover/debug state
* app-only invalidation hints

## Reconnect Recovery

Clients do not rebuild state from missed websocket events. They refetch durable
resources and let React Query reconcile active views.

The Server UI keeps one tRPC client and React provider mounted for the signed-in
human. Clerk token rotation reconnects only that client's websocket; the reconnect
reads fresh connection parameters and resumes its pending subscriptions. Credential
rotation must not replace the tRPC provider, remount the Server shell, clear composer
drafts, or discard other local presentation state. A genuine human identity change
renders through a newly keyed hosted QueryClient/provider, so the next identity never
observes the previous identity's cache or local presentation state.

Reconnect flow:

1. Keep rendering cached query data while the socket reconnects.
2. When the websocket reconnects, invalidate active Runtime-backed queries.
3. Refetch chat history, artifacts, agents, presence, activity, sessions,
   skills, stats, or other visible resources through their normal API reads.
4. Resume applying live notifications.

Hosted Reminders use the same principle with a narrower lane: keep the last
query snapshot rendered, walk `reminder.changes` from the hook's cursor,
invalidate reminder list and run queries, then continue live
`reminder.onEvent` delivery.

History recovery does not depend on the event log retaining full message
payloads. If a client suspects missed events, it refetches the affected
resource.

## Ordering

* Hosted `chat_events.cursor` is monotonic and commit-ordered within one Server.
* Hosted message order is the transactional positive per-Chat sequence.
* A fire's `message.created` cursor precedes its `reminder.changed` cursor.
* `chat_events.cursor` is monotonic inside Runtime SQLite.
* Message timeline order is `chat_messages.sequence`, not event cursor.
* Event cursor order records mutation order for inspection.
* Sequence order tells clients how to render chat history.
* Final reconciliation upserts by stable ids.

## App Stream Boundary

Grotto App can expose its own websocket or tRPC subscriptions for UI
invalidation. Those subscriptions are app notifications.

Product state still comes from:

* `GET /api/chats/{chat_id}/messages`
* artifact reads for the chat timeline
* focused resource reads for automations, skills, and stats
* the agent activity feed, presence, and inbox reads for execution evidence

## What Is Intentionally Missing

* WebSocket-only durable state.
* Message history stored only in event payloads.
* Response activity created from app-local UI state.
* Hidden chain-of-thought in realtime events.
* Runtime session sequence as an event cursor.

## Related Docs

* [API overview](overview.md)
* [Chat API](chat.md)
* [Data model](../internals/data-model.md)
