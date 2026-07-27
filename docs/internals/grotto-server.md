---
summary: The hosted Grotto Server's PostgreSQL collaboration state, local attachment bytes, recovery, realtime, and direct App surface.
read_when:
  - changing Grotto Server creation, slugs, membership, roles, or Channels
  - changing hosted PostgreSQL schema or Server authorization
  - changing the hosted Server / local sidecar application boundary
  - changing how Clerk authentication maps to a Grotto User
  - changing hosted attachment storage, recovery, or inventory
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
| Hosted Grotto Server | `src/grotto-server.ts` | Server tRPC plus authorized streamed attachment upload/download | PostgreSQL plus the Server attachment root |
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
`connectionParams.clerkSessionToken` on the WebSocket.

### Authorized party

One Clerk instance signs tokens for every frontend attached to it, so a valid
signature and issuer do not say a token was minted for this App. The `azp`
claim names the frontend that asked for it, and the Server judges it after
signature, configured issuer, expiry, and subject all pass:

| `azp` | Outcome |
| --- | --- |
| Absent | Accepted — Clerk omits it when no browser Origin took part, as with the native header-authenticated desktop session |
| Exactly `APP_ORIGIN` | Accepted |
| Another origin | Rejected — a same-instance token minted for someone else's frontend |
| `null`, non-string, or empty | Rejected |

The only authorized party is `APP_ORIGIN`'s exact origin. A `file://` origin, a
loopback or localhost guess, and the CORS origin predicate are never authorized
parties — CORS decides which browsers may call the Server, not whose tokens it
trusts.

Accepting an absent `azp` is a deliberate trade for native desktop sessions,
and matches `@clerk/backend`, which also skips the check when the claim is
missing. The issuer check still bounds it: the token must come from the
configured Clerk instance.

## State

PostgreSQL owns the hosted collaboration tables
(`apps/server/src/postgres/schema/`):

| Table | Owns |
| --- | --- |
| `users` | Grotto Users keyed by a unique `clerk_user_id` |
| `servers` | Opaque id, address/display fields, and the commit-serialized Chat event cursor |
| `server_memberships` | One human's standing access, Server role, and internal revocation marker |
| `chats` | Server-owned Channels and canonical sorted two-human DMs |
| `channel_participants` | One human's participation in one Channel |
| `chat_messages` | Immutable human messages ordered by per-Chat sequence and nonce |
| `chat_reads` | One monotonic reader high-water mark per Chat |
| `chat_events` | Durable message/read events ordered by PostgreSQL cursor |
| `attachments` | Server/Chat-scoped metadata, upload state, content digest, and optional message association |

Every relationship and every authorization check uses the opaque Server id. The
slug is only the human-facing address at `/s/<slug>`; it never moves, and no
procedure accepts a new one.

Every hosted collaboration row carries `server_id`. Composite foreign keys bind
Chats, participants, messages, reads, events, and memberships to the same
Server. Invariants live in PostgreSQL, not only TypeScript: role, Chat shape,
positive message sequence, nonce uniqueness, DM pair ordering, and event shape
all fail closed in the database.

`apps/server/src/postgres/bootstrap.ts` is the schema of record — fresh-schema
DDL applied when the application starts, mirroring the SQLite bootstrap seam.
`schema.ts` describes the same tables for typed queries. There is no migration
history and no migration tooling.

## Attachment storage and recovery

`GROTTO_ATTACHMENT_ROOT` is the absolute Server-owned byte root. Startup creates
it as `0700` and validates that the root and fixed layout directories are
non-symlink directories:

```text
<root>/
  servers/<sha256(server-id)>/
    objects/<sha256(server-id + attachment-id)>
    staging/<sha256(upload-attempt-id)>
```

Clients supply only opaque ids. Authorization resolves a PostgreSQL row before
storage is touched; names, MIME types, URLs, and encoded separators never
become paths. Leaf opens use `O_NOFOLLOW` and `fstat` where Node/Bun exposes
them. Expected symlink or non-regular leaves fail closed. A same-UID local
administrator racing path syscalls is outside this trust boundary.

Uploads move through `pending → uploading → finalizing → ready` (or `failed`):

1. Reserve metadata idempotently by Server, uploader, and client nonce.
2. Claim one attempt; stream and hash into a private staging leaf; enforce 50
   MiB independently of `Content-Length`; fsync the file.
3. Commit byte count, hash, and `finalizing` in PostgreSQL.
4. Atomically rename to the immutable object leaf and fsync both affected directories.
5. Commit `ready`.

Before the finalizing commit, failures remove the exact staging leaf and mark
the row failed. After that commit, startup reconciliation verifies staged or
renamed bytes against PostgreSQL, completes the rename when needed, and commits
ready. Interrupted writes become failed; missing finalization bytes are
recorded as failed; contradictory or substituted leaves stop startup. A lost
success response retries idempotently against the ready row.

Owner/Admin attachment inventory returns every attachment row, expected
root-relative object/staging key, and every actual regular leaf for that
Server. It never returns the absolute root. This is the cleanup and future
Server-deletion seam; PRD-142 does not delete Servers.

Membership revocation sets `server_memberships.revoked_at`; it does not delete
the row. This keeps immutable message authors and canonical DM pairs intact
while every membership gate fails closed. There is no invite, removal, or
member-management procedure in this slice.

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
- `chat.*` resolves current membership and Chat participation before every
  read or write. Durable and composition subscriptions recheck that access for
  each event delivery.
- Durable delivery skips inaccessible Chats without ending the Server feed.
  Revoked Server membership ends delivery.

A human without membership gets `FORBIDDEN`; an address with no Server gets
`NOT_FOUND`. App-side checks are presentation only.

## App surface

- `/s` lists the Servers this human can open and creates new ones.
- `/s/<slug>` opens Server-owned Chats, transcript, composer, reads, and search.
  It reserves and streams local files to the hosted Server, renders only
  attachment metadata in messages, and performs authenticated downloads. An
  author already visible in the transcript is the entry point for their DM.

These routes are a separate top-level route-tree branch and run on their own
client — `apps/website/src/lib/grotto-server.tsx`
— pointed at `VITE_GROTTO_SERVER_ORIGIN`, with the Clerk session attached per
request and per WebSocket connection. They never use the local sidecar's
client, and no product operation is routed through Electron IPC. Hooks live in
`apps/website/src/hooks/servers/`. The local Command menu, Runtime gates, and
sidecar query hooks exist only in the ordinary local route branch.

A socket presents the Clerk session it was opened with, so the provider watches
the current session and opens a fresh connection when Clerk rotates the token;
subscriptions re-register against it while cached query data stays put. The
Server independently verifies a current token on every operation, including
each subscription start, so an expired session is refused rather than
tolerated.

Live durable notifications and composition are process-local signals.
PostgreSQL cursors heal durable notification loss on reconnect; composition is
intentionally best-effort and disappears instead of replaying.
