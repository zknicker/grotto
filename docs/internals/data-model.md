---
summary: Current persistence ownership across Server PostgreSQL, Computer state, and App cache.
read_when:
  - changing database schema, persistence ownership, or durable product records
  - deciding whether state belongs in Server, Computer, or App
---

# Data model

Grotto Server's PostgreSQL database is the canonical store for collaboration and authorization.
The Drizzle schema lives in `apps/server/src/postgres/schema.ts`; checked-in migrations live in
`apps/server/drizzle/postgres/`. Fresh databases are created by
`apps/server/src/postgres/bootstrap.ts`, while existing production databases advance only through
the migration command.

| Store | Owner | Contents |
| --- | --- | --- |
| Server PostgreSQL | Grotto Server | Users, Servers, membership, Chats, Messages, threads, Tasks, Reminders, Agents, prepared action cards and their media, desired execution configuration, Computer attachments and reports, MCP connections, Triggers and their fire history, automation provenance on Agent messages, and authorization. |
| Computer data root | Grotto Computer | Attachment credentials, delivery queues, logs, Agent homes, skills, workspaces, runtime state, cached provider-usage snapshots, and effective execution evidence. |
| Browser/App storage | Grotto App | Cache, local preferences, desktop presentation state, and optimistic rows. |

An active Agent's unmaterialized pairwise DM is App-local selection state, not a
Chat record. PostgreSQL creates the canonical human membership-stint↔Agent Chat
only in the same transaction as the first durable write. Materialized history
stays id-bound after retirement while the implicit roster entry disappears.

Server stores bounded turn summaries and Computer-reported effective runtime, model, and reasoning
effort needed for truthful product presentation.
`computer_system_events` is the durable operational log for each Computer. Server records observed
connections and disconnections; Computer reports a bounded, idempotent outbox of state-changing
management commands. Server does not ingest provider credentials, full prompts, execution
transcripts, arbitrary tool traces, or Agent workspace contents. Computer state is not a substitute
for canonical Chat history, and App cache is never authoritative.

The Agent row stores Computer's last applied Grotto Agent version, application timestamp, and
pending/current/failed status. These fields are a product-facing release receipt, not the underlying
instruction or bootstrap fingerprints. Server compares the receipt with its release-owned current
version when projecting an Agent. Computer remains authoritative for whether a successful turn has
actually applied that version.

Semantic Agent activity is durable Server metadata. Detailed execution journals remain
Computer-local and are read only through an authorized live relay.

`prepared_actions` is the immutable Server record for an Agent-authored proposal. It is anchored
to one canonical Agent message and carries the narrow action kind, validated proposal, proposer,
nonce, and lifecycle fields. `prepared_action_media` stores the exact avatar bytes owned by that
action; it is never replaced in place and is served through an immutable media URL. A correction
is a new action row that records `superseded_by_action_id`; a partial unique pending index and the
Server lock make same-proposer supersession atomic while leaving other proposers independent.
Prepared rows and media are deleted with their Chat/action, while the canonical message and event
cursor remain the recovery boundary for App clients. A successful commit stores the submitted
execution values and committing human in `prepared_actions.executed_result`,
`executed_by_user_id`, and `executed_at`; the proposal JSON and action-owned media never change.
`agent_action_attentions` stores one record-only proposer handoff keyed by `(server_id, action_id)`
with the originating Chat, executed result, created Agent, and dedupe key. PRD-261 writes that row
atomically; PRD-262 materializes it as one `agent_inbox` row and owns the
Server-to-Computer delivery, exact action identity, and execution settlement. The
pending row uses the action id as its durable work identity and remains in the
retained delivery ledger after `seen`.

`triggers` is the Agent-owned inbound wake: owner Agent, `kind` (checked against `webhook`),
anchor Chat and nullable anchor message, `created_by_user_id` for a Trigger a human created from
the App and null for one an Agent created (it clears if that human is removed), title, optional
instruction, the SHA-256 hash of its bearer secret, armed or disabled status, and fire counters.
`anchor_message_id` is the message someone asked on and is null for a human-created Trigger,
which anchors on that human's DM with the owning Agent and writes no Chat message; the Chat is
then the whole access check. Grotto never stores a Trigger secret in plaintext.
`trigger_fires` stores one row per accepted inbound request with the verbatim payload bounded at
65,536 bytes, its byte count, and its optional content type and idempotency key. Deleting a
Trigger cascades to its fires. Server bounds and relays those payloads and never interprets them.
A fire wakes the owning Agent through the ordinary `agent_inbox` ledger; no
Trigger-specific attention table exists.

A fire writes no Chat message (ADR 0026). `message_causes` is the provenance record instead: one
row per message an Agent sent because a fire woke it, naming the kind (`trigger_fire` or
`reminder_fire`), the automation and fire that caused it, and an `attribution` checked against
`explicit` (the Agent sent `--cause`) or `inferred` (the Server derived it from a sole-fire run,
per `specs/inbox.md`). Alongside those it snapshots what the mark says — title, summary, fire time,
owning Agent, and anchor Chat — so the mark outlives the automation: the automation and fire ids
carry no foreign key, and deleting a Trigger or reminder archives the mark instead of removing it.
A message carries at most one cause, and only deleting the message deletes it. The Server writes the row in the same transaction as the message and
only after validating that the fire belongs to an automation the sending Agent owns.

Every `chat_messages` row is authored by a human or an Agent and readable by every human who can
read its Chat (ADR 0026). `system_author` is gone — column, CHECK clause, and wire enum — after the
migrations deleted the `reminder`, `trigger`, `task`, and `session` rows written with it, dropped
the `schedule_receipt_message_id` column on `reminders` and the `receipt_message_id` columns on
`reminder_fires`, `trigger_fires`, and `reminder_agent_attention`, and nulled the Trigger anchors
that pointed at deleted creation receipts. An agent-only delivery is an `agent_inbox` row keyed by a
non-message identity — an action id, a fire id, a task assignment identity — not a message with a
filter over it; `agent_inbox` is the renamed `agent_pending_work` and `agent_delivery` keeps its own
name for per-Agent run state.

An Agent message carries `session_generation`, the generation of the run that sent it (null for a
human message), and `agent_session_rotations` records each rotation with its generation, timestamp,
and reason. Together they replace the session receipt message: the App derives the per-Chat session
mark from the stamps and reads the rotation record only for the hover card (`specs/sessions.md`).

The Server application PostgreSQL role receives normal table/sequence privileges; migration and
backup roles remain separate operational credentials.
