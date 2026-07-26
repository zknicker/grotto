---
summary: The hosted Grotto Server's PostgreSQL ownership of Users, Servers, memberships, and Channels, its Clerk identity mapping, and the App's /s/<slug> surface.
read_when:
  - changing Grotto Server creation, slugs, membership, roles, or Channels
  - changing hosted PostgreSQL schema or Server authorization
  - changing the hosted Server / local sidecar application boundary
  - changing how Clerk authentication maps to a Grotto User
---

# Grotto Server

A Grotto server is the durable collaboration container
([ADR 0019](../adr/0019-servers-own-collaboration-computers-own-execution.md)).
The hosted Server owns its state in PostgreSQL and the App talks to it directly
over tRPC HTTP and WebSocket.

## Two applications

During the expand phase the repository builds two separate applications, and
neither reaches into the other:

| Application | Entrypoint | Serves | Storage |
| --- | --- | --- | --- |
| Hosted Grotto Server | `src/grotto-server.ts` | `grottoRouter` — the Server contract only, every operation Clerk-authenticated | PostgreSQL |
| Local sidecar (pre-WS6) | `src/index.ts` | `appRouter`/`wsRouter` — the legacy local-owner contract | SQLite |

The packaged desktop app launches the local sidecar with a `--database-path`
and no PostgreSQL, so the hosted application must never be in that process.
Legacy local-owner procedures — settings, runtime control, member removal,
`identity.pushSessionToken` — are not registered on the hosted transport and
answer `404` there. CORS restricts origins; it does not authorize anyone.

## Identity

Clerk authenticates humans and nothing more. A verified session token's subject
is the external reference used to find the stable Grotto User. Clerk
Organizations and Clerk role claims are never read and carry no authority.

Authentication carries that subject for one request only. It never writes to the
database and never publishes the token to shared process state, so concurrent
humans cannot bleed into each other. The local sidecar's `agentRuntime.connect` and
`identity.pushSessionToken` still hand a session to its Runtime transport, and
they do it explicitly — neither procedure exists on the hosted Server.

A Grotto User is minted in exactly one place: inside Server creation's
transaction. Reads resolve an existing User or find none — asking never mints
one, so an authenticated human who has done nothing leaves no row behind.

`CLERK_ISSUER_URL` names the Clerk instance whose JWKS signs those tokens. The
App attaches the token as `Authorization: Bearer` on HTTP and as
`connectionParams.clerkSessionToken` on the WebSocket. Verification also
requires the token's Clerk authorized party (`azp`) to equal `APP_ORIGIN`;
same-instance tokens minted for another frontend are refused.

## State

PostgreSQL owns five tables (`apps/server/src/postgres/schema/`):

| Table | Owns |
| --- | --- |
| `users` | Grotto Users keyed by a unique `clerk_user_id` |
| `servers` | Opaque id, globally unique immutable `slug`, editable `display_name` |
| `server_memberships` | One human's standing access and Server role |
| `channels` | Server-owned Channels, unique by name inside one Server |
| `channel_participants` | One human's participation in one Channel |

Every relationship and every authorization check uses the opaque Server id. The
slug is only the human-facing address at `/s/<slug>`; it never moves, and no
procedure accepts a new one.

Invariants live in PostgreSQL, not only in TypeScript: `server_memberships.role`
carries a `server_memberships_role` CHECK for `owner`, `admin`, and `member`, so
a write from any path is refused by the database.

`apps/server/src/postgres/bootstrap.ts` is the schema of record — fresh-schema
DDL applied when the application starts, mirroring the SQLite bootstrap seam.
`schema.ts` describes the same tables for typed queries. There is no migration
history and no migration tooling.

## Creation

`server.create` commits one transaction: the creator's Grotto User, the opaque
Server id, its slug and display name, the first human Owner membership, and the
`#all` Channel with that Owner participating. It creates no Computer, Agent, or
execution configuration. A taken slug is refused as `CONFLICT`, and the whole
transaction rolls back — including a first-time creator's User.

## Authorization

`apps/server/src/servers/server-access.ts` is the single membership gate. Every
Server query, mutation, and subscription resolves membership through it:

- `server.list` returns only the Servers the human belongs to.
- `server.bySlug` resolves the address, then authorizes by Server id.
- `server.rename` authorizes before writing the display name.
- `server.onUpdate` checks membership in middleware, so a non-member is refused
  at subscription registration and never reaches event delivery.

A human without membership gets `FORBIDDEN`; an address with no Server gets
`NOT_FOUND`. App-side checks are presentation only.

## App surface

- `/s` lists the Servers this human can open and creates new ones.
- `/s/<slug>` opens one Server with its Channel switcher and `#all`.

These routes run on their own client — `apps/website/src/lib/grotto-server.tsx`
— pointed at `VITE_GROTTO_SERVER_ORIGIN`, with the Clerk session attached per
request and per WebSocket connection. They never use the local sidecar's
client, and no product operation is routed through Electron IPC. Hooks live in
`apps/website/src/hooks/servers/`.

A socket presents the Clerk session it was opened with, so the provider watches
the current session and opens a fresh connection when Clerk rotates the token;
subscriptions re-register against it while cached query data stays put. The
Server independently verifies a current token on every operation, including
each subscription start, so an expired session is refused rather than
tolerated.
