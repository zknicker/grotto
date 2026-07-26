---
summary: Realtime contract for durable chat events, the tRPC app-invalidation event set, the ephemeral composition stream, reconnect refetch, and app stream boundaries.
read_when:
  - changing websocket subscriptions or reconnect behavior
  - adding a durable event type or a new tRPC invalidation event
  - changing the composition stream, presence, or realtime recovery semantics
---

# Realtime

Realtime is notification plus recovery.

Runtime SQLite is the source of truth. WebSocket delivery is allowed to drop.
Clients recover by refetching durable resources through normal Tavern API reads.

## Components

| Component | Owner | Role |
| --- | --- | --- |
| `chat_events` | Tavern Runtime | Durable cursor-backed event log |
| `chat_responses` / `chat_response_activity` | Tavern Runtime | Durable response/activity rows (real agent turns no longer populate them — see [Chat API](chat.md)) |
| `chat_artifacts` | Tavern Runtime | Durable renderable outputs |
| Event list | Tavern Runtime | Inspectable recent events derived from `chat_events` |
| App websocket | Tavern App | UI invalidation and client notifications (`agent.updated`, `chat.updated`, `chat.log.updated`, `model.updated`, `server.updated`, `session.updated`, `skill.updated`, `pane.updated`, `agent-runtime.updated`, `agent-runtime-capability.updated`, `engine-restart.updated`, and similar) |

`server.updated` is Server-scoped: `server.onUpdate` takes a Server id, checks
membership before the subscription starts, and delivers only that Server's
events. See [Grotto Server](../internals/grotto-server.md).

App websocket events are not the durable event source. They can mirror Runtime
events, but missed app notifications recover through Tavern API reads.

The event list does not own a second event log. App notifications are derived
from durable `chat_events`.

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
* agent presence (busy/idle)
* short-lived hover/debug state
* app-only invalidation hints

## Reconnect Recovery

Clients do not rebuild state from missed websocket events. They refetch durable
resources and let React Query reconcile active views.

Reconnect flow:

1. Keep rendering cached query data while the socket reconnects.
2. When the websocket reconnects, invalidate active Runtime-backed queries.
3. Refetch chat history, artifacts, agents, presence, activity, sessions,
   skills, stats, or other visible resources through their normal API reads.
4. Resume applying live notifications.

History recovery does not depend on the event log retaining full message
payloads. If a client suspects missed events, it refetches the affected
resource.

## Ordering

* `chat_events.cursor` is monotonic inside Runtime SQLite.
* Message timeline order is `chat_messages.sequence`, not event cursor.
* Event cursor order records mutation order for inspection.
* Sequence order tells clients how to render chat history.
* Final reconciliation upserts by stable ids.

## App Stream Boundary

Tavern App can expose its own websocket or tRPC subscriptions for UI
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
