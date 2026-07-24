# Tavern Runtime Chat Server

Tavern Runtime is the always-on chat server.

The Mac app can close. Agents, automations, deliveries, and event history keep
running. When the app reconnects, it reads runtime chat history and event
cursors instead of reconstructing the product timeline from agent transcripts.

## Problem

Tavern cannot be only a local app wrapper over an agent engine. That shape is
not enough for always-on agent work:

* Automations need to create messages while the app is closed.
* Agents need to post replies into chats while the app is closed.
* Reconnect recovers from Tavern chat history, not from fuzzy agent
  transcript mapping.
* Websocket delivery can drop, but missed state must remain recoverable.

## Decision

Tavern Runtime owns canonical chat state:

* chats
* participants
* messages
* responses
* response activity
* artifacts
* events
* reads
* deliveries
* automations and automation runs

Tavern App is the first-party client. It may cache data and keep presentation
state, but it is not the durable chat server.

Runtime owns the local execution engine contract: sessions, turns, tools, model
calls, files, and native transcripts. Those records are execution evidence
linked to Tavern messages, not the product timeline.

## Tables

Runtime SQLite owns:

```text
chats
chat_participants
chat_messages
chat_responses
chat_response_activity
chat_artifacts
chat_events
chat_reads
chat_deliveries
runtime_sessions
runtime_turns
runtime_transcript_messages
runtime_tool_calls
automations
automation_runs
```

Memory, Wiki, and search are runtime-owned product surfaces. The Wiki page reads the
configured Wiki root; context-management status reads Runtime
prompt-time readiness. Table details live with those feature contracts.

## App Cache And Evidence

App tables are cache, presentation, or runtime evidence:

| Current table | Runtime role |
| --- | --- |
| `chats` | app cache of runtime `chats` |
| `session_runs` | runtime session/turn evidence linked to `chat_responses` |
| `session_messages` | `runtime_transcript_messages` evidence |
| `session_message_parts` | transcript evidence and candidate `chat_artifacts` |
| `session_tool_calls` | tool evidence linked to `chat_response_activity` |
| `session_artifacts` | candidate `chat_artifacts` |
| `cron_jobs` | `automations` |
| `cron_runs` | `automation_runs` |

## Invariants

* Message creation is durable first.
* Per-chat `sequence` is assigned in the same transaction as message insert.
* Durable events are inserted in the same transaction as the mutation.
* Duplicate `message.id` or `(chat_id, nonce)` returns the existing message.
* External frontend delivery is queued after the durable message exists.
* Assistant replies are Tavern messages authored by agent participants.
* Agent work is a durable response with ordered response activity.
* Tool progress and results update the same durable activity rows by identity.
* Code, images, files, diffs, documents, and charts are artifacts.
* Agent transcript rows link to Tavern messages and never replace them.
* Soft deletes preserve sequence slots.
* Reconnect recovers by runtime history and event cursor.
* Content/timestamp duplicate detection is not allowed.

## API Shape

The Tavern API is OpenAPI-defined and runtime-hosted.

Chat operations:

```text
POST /api/chats
GET /api/chats
GET /api/chats/{chat_id}
GET /api/chats/{chat_id}/messages?after_sequence=&limit=
GET /api/chats/{chat_id}/responses?after_sequence=&limit=
POST /api/chats/{chat_id}/messages
POST /api/chats/{chat_id}/deliveries
POST /api/chats/{chat_id}/responses
POST /api/chats/{chat_id}/responses/{response_id}/activity
POST /api/chats/{chat_id}/artifacts
POST /api/chats/{chat_id}/read
DELETE /api/messages/{message_id}
GET /api/events?after_cursor=
GET /api/events/ws
```

OpenAPI lives in `packages/tavern-api/openapi.yaml`. Runtime handlers return
that shape. `@tavern/sdk` wraps it for the app, automations, webhooks, local
tools, and tests.

## Test Gates

* Duplicate sends with the same id or nonce return the same message receipt.
* Hard reload recovers one user message and one assistant reply from runtime
  chat history.
* Websocket drop/reconnect recovers by event cursor and history read.
* Final agent transcript sync cannot create a second user row.
* Automations can append chat messages while the app is closed.
* Tool progress and reasoning summaries persist as response activity before the
  final reply.
* Soft delete preserves message sequence.

## References

* [Data model](../docs/internals/data-model.md)
* [Architecture overview](../docs/internals/architecture-overview.md)
* [Chat API](../docs/api/chat.md)
* [Realtime](../docs/api/realtime.md)
* [Tavern Runtime](../docs/internals/runtime.md)
