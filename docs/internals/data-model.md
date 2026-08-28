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
| Server PostgreSQL | Grotto Server | Users, Servers, membership, Chats, Messages, threads, Tasks, Reminders, Agents, prepared action cards and their media, desired execution configuration, Computer attachments and reports, MCP connections, and authorization. |
| Computer data root | Grotto Computer | Attachment credentials, delivery queues, logs, Agent homes, skills, workspaces, runtime state, cached provider-usage snapshots, and effective execution evidence. |
| Browser/App storage | Grotto App | Cache, local preferences, desktop presentation state, and optimistic rows. |

An active Agent's unmaterialized pairwise DM is App-local selection state, not a
Chat record. PostgreSQL creates the canonical human membership-stint↔Agent Chat
only in the same transaction as the first durable write. Materialized history
stays id-bound after retirement while the implicit roster entry disappears.

Server stores bounded turn summaries and effective-state reports needed for product presentation.
`computer_system_events` is the durable operational log for each Computer. Server records observed
connections and disconnections; Computer reports a bounded, idempotent outbox of state-changing
management commands. Server does not ingest
provider credentials, full prompts, execution transcripts, arbitrary tool traces, or Agent
workspace contents. Computer state is not a substitute for canonical Chat history, and App cache is
never authoritative.

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
atomically; PRD-262 materializes it as one `agent_pending_work` row and owns the
Server-to-Computer delivery, exact action identity, and execution settlement. The
pending row uses the action id as its durable work identity and remains in the
retained delivery ledger after `seen`.

The Server application PostgreSQL role receives normal table/sequence privileges; migration and
backup roles remain separate operational credentials.
