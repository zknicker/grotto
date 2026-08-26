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

Server stores bounded turn summaries and effective-state reports needed for product presentation. It
does not ingest provider credentials, full prompts, execution transcripts, arbitrary tool traces,
or Agent workspace contents. Computer state is not a substitute for canonical Chat history, and App
cache is never authoritative.

Semantic Agent activity is durable Server metadata. Detailed execution journals remain
Computer-local and are read only through an authorized live relay.

`prepared_actions` is the immutable Server record for an Agent-authored proposal. It is anchored
to one canonical Agent message and carries the narrow action kind, validated proposal, proposer,
nonce, and lifecycle fields. `prepared_action_media` stores the exact avatar bytes owned by that
action; it is never replaced in place and is served through an immutable media URL. A correction
is a new action row that records `superseded_by_action_id`; a partial unique pending index and the
Server lock make same-proposer supersession atomic while leaving other proposers independent.
Prepared rows and media are deleted with their Chat/action, while the canonical message and event
cursor remain the recovery boundary for App clients. Human execution fields are nullable until
the separate commit flow exists.

The Server application PostgreSQL role receives normal table/sequence privileges; migration and
backup roles remain separate operational credentials.
