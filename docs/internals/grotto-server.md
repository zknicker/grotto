---
summary: The hosted Grotto Server's PostgreSQL ownership of collaboration, reminders, durable attention, and realtime, plus its direct App surface.
read_when:
  - changing Grotto Server creation, slugs, membership, roles, or Channels
  - changing hosted PostgreSQL schema or Server authorization
  - changing reminder scheduler lifecycle or hosted Agent attention
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
| `server_memberships` | One human's standing access, Server role, numbered stint, stint start, and internal revocation marker |
| `server_invitations` | Email-bound, single-use invitations by SHA-256 token hash |
| `chats` | Server-owned Channels, canonical sorted two-human DMs, and hidden child Threads |
| `channel_participants` | One human's participation in one Channel |
| `thread_follows` | Per-human Thread attention; never membership |
| `agents` / `channel_agent_participants` | Minimal hosted Agent identity and Channel access required by reminder authorship |
| `chat_messages` | Immutable human or reminder-system messages ordered by per-Chat sequence and nonce |
| `chat_reads` | One monotonic reader high-water mark per Chat |
| `chat_events` | Durable message/read/reminder-change events ordered by PostgreSQL cursor |
| `reminders` / `reminder_commands` | Author-owned schedules and idempotent optimistic commands with original result snapshots |
| `reminder_fires` | One durable row per logical scheduled fire |
| `reminder_agent_attention` | One unacknowledged fire snapshot for the owning Agent |

Every relationship and every authorization check uses the opaque Server id. The
slug is only the human-facing address at `/s/<slug>`; it never moves, and no
procedure accepts a new one.

Every hosted collaboration row carries `server_id`. Composite foreign keys bind
Chats, participants, messages, reads, events, and memberships to the same
Server. Invariants live in PostgreSQL, not only TypeScript: role, Chat shape,
positive message sequence, nonce uniqueness, DM pair ordering, and event shape
all fail closed in the database.

`apps/server/src/postgres/bootstrap.ts` is the schema of record — fresh-schema
DDL applied by the explicit bootstrap command before the application starts.
`schema.ts` describes the same tables for typed queries. Runtime has table DML
authority but no DDL authority. There is no migration history or tooling.

## Reminder scheduler

The hosted process starts one concrete reminder scheduler after PostgreSQL
bootstrap. It performs an immediate recovery tick, then checks every 15
seconds. PostgreSQL row locks with `SKIP LOCKED` serialize concurrent ticks,
and a unique logical-fire key prevents duplicate receipts after response loss
or restart. One overdue slot fires and recurring cadence advances from the
current time; missed slots never burst. A row-local fire failure is redacted,
skipped for the rest of that tick, retried later, and does not block other due
reminders.

A fire transaction appends the visible reminder system message, fire log,
pending Agent attention, reminder state, and durable events atomically. The
Server performs no network, model, process, shell, workspace, or script work in
that transaction. Script text is opaque, size-bounded delivery data for a
future Computer-local path.

`/healthz` reports only the scheduler's redacted state and safe timestamps.
Shutdown stops new ticks and awaits any in-flight tick before closing
PostgreSQL. Pending attention is durable across shutdown but defines no
transport or acknowledgment behavior.

Membership revocation sets `server_memberships.revoked_at`; it does not delete
the row. This keeps immutable message authors and historical DM pairs intact
while every membership gate fails closed.

## Membership

Humans hold Member, Admin, or Owner. A Server may have several Owners and must
always keep one. One rule decides every change and is shared by the Server and
the App as `resolveServerMemberAuthority` in `@tavern/api`:

- Owners and Admins issue and revoke invitations.
- An Admin manages Members, including promoting one to Admin. An Admin never
  acts on a peer Admin or an Owner.
- Only an Owner grants or revokes Owner.
- Anyone may step down; nobody promotes themselves.
- The last Owner cannot be removed, demoted, or leave.

Granting authority and taking access away both require the human to type the
Server's immutable slug: every elevation (Member to Admin, and Member or Admin
to Owner), plus removal, leaving, and revoking Owner. Stepping an Admin down to
Member is the one ordinary confirmation — it grants nothing and costs no
access. The Server verifies that confirmation inside the same transaction; the
App's copy is presentation.

Every remove, demote, and leave locks the `servers` row before counting Owners,
so two Owners racing to unseat each other serialize and exactly one commits.
That reuses the row which already serializes durable Chat event cursors rather
than adding a second locking scheme.

## Invitations

An invitation is email-bound, single-use, and expires seven days after it is
issued. Grotto stores only the token's SHA-256 hash: `invitation.create`
returns the raw token once, to the issuer, and no procedure ever reads it back.
Creation and revocation lock the Server row, then reauthorize the Owner or
Admin inside the transaction. Grotto sends no email — delivery is manual.

`invitation.accept` commits one transaction. It locks the invitation row,
refuses anything unknown, revoked, consumed, or lapsed with one indistinguishable
answer, requires a Clerk-verified email equal to the bound address, then creates
or resets the membership into a fresh Member stint joined to exactly `#all`.
Concurrent acceptances of one token serialize on that row lock, so only the
first commits.

A returning human reuses their existing membership row because authored
messages and historical DM pairs point at it. Acceptance resets it to `member`
with a new `joined_at`, increments its `stint`, and joins only `#all`. A DM
records both participants' stint numbers: the returning human cannot read the
former DM or its Threads, while the peer who did not leave retains that
history. Removal clears `channel_participants`, `chat_reads`, and
`thread_follows`, and retires live composition state for every departed Chat
including Threads.

`CLERK_SECRET_KEY` authorizes the Clerk Backend API lookup that reads which of a
human's addresses Clerk has verified; it is the only Grotto surface that reads a
human's addresses. Without it the Server still runs and invitations simply
cannot be accepted. `CLERK_API_URL` overrides the Clerk Backend origin for a
non-production instance.

The one address Grotto stores is `server_invitations.email`, the address an
invitation is bound to, supplied by the Owner or Admin who issued it. It is a
target for that invitation, never an identity: Clerk alone decides which
addresses a human has verified, `users` holds no email, and an accepted
invitation copies nothing onto the membership.

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
  read or write. Thread access resolves through the parent Channel or DM.
  Durable and composition subscriptions recheck that access for each event delivery.
- Durable delivery skips inaccessible Chats without ending the Server feed.
  Revoked Server membership ends delivery.

A human without membership gets `FORBIDDEN`; an address with no Server gets
`NOT_FOUND`. App-side checks are presentation only.

## App surface

- `/s` lists the Servers this human can open and creates new ones.
- `/s/<slug>` opens Server-owned Chats, transcript, composer, reads, and search.
  An author already visible in the transcript is the entry point for their DM.
  Message replies open hidden child Threads in the resizable side pane; Threads
  never enter the hosted sidebar Chat list.
- `/s/<slug>/members` manages humans and invitations.
- `/invite/<token>` is where an invited human accepts. It sits outside the
  `/s/<slug>` branch because a Server address may itself be `invite` or `join`.
  Manual links use `VITE_GROTTO_APP_ORIGIN` when configured, so a packaged App
  never exposes its private `file:` URL; that origin must match `APP_ORIGIN`.

These routes are a separate top-level route-tree branch and run on their own
client — `apps/website/src/lib/grotto-server.tsx` — using the browser's same
origin in production and the `VITE_GROTTO_SERVER_ORIGIN` override in
development, with the Clerk session attached per request and per WebSocket
connection. They never use the local sidecar's client, and no product operation
is routed through Electron IPC. Hooks live in `apps/website/src/hooks/servers/`.
The local Command menu, Runtime gates, sidecar query hooks, and query cache exist
only in the ordinary local route branch.

A socket presents the Clerk session it was opened with, so the provider watches
the current session and opens a fresh connection when Clerk rotates the token;
subscriptions re-register against it while cached query data stays put. The
Server independently verifies a current token on every operation, including
each subscription start, so an expired session is refused rather than
tolerated.

Live durable notifications and composition are process-local signals.
PostgreSQL cursors heal durable notification loss on reconnect; composition is
intentionally best-effort and disappears instead of replaying.

Thread message and follow notifications retain the existing durable event row
shape. The public event adds only `parentChatId`, nullable for top-level Chats,
so the App can refetch the child and its exact parent summary without carrying
anchor or message content in the event.

## Production

The single-node production Server listens on `127.0.0.1:18791` and serves the
hosted App, tRPC HTTP, WebSocket, and `/healthz` from `https://grotto.sh`.
Cloudflare is limited to DNS, TLS, and named Tunnel ingress. PostgreSQL,
attachment storage, and jobs remain local to the Mac mini. See
[Grotto Server deployment](../operations/grotto-server-deploy.md).
