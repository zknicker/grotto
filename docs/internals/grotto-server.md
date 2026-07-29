---
summary: The hosted Grotto Server's PostgreSQL collaboration, reminders, durable attention, local attachment bytes, recovery, realtime, and direct App surface.
read_when:
  - changing Grotto Server creation, slugs, membership, roles, or Channels
  - changing hosted PostgreSQL schema or Server authorization
  - changing reminder scheduler lifecycle or hosted Agent attention
  - changing the hosted Server / local sidecar application boundary
  - changing how Clerk authentication maps to a Grotto User
  - changing hosted attachment storage, recovery, or inventory
---

# Grotto Server

## MCP ownership

PostgreSQL owns remote HTTP MCP connection identity, secret headers, OAuth
state and tokens, discovered tool inventory, and connection-level Agent
grants. Grotto Server owns MCP clients and invokes upstream tools. Computer
receives safe schemas and proxies Agent calls through a scoped runner
credential; it never receives MCP credentials or sessions. Local and stdio
MCP connections are not supported.

A Grotto server is the durable collaboration container
([ADR 0019](../adr/0019-servers-own-collaboration-computers-own-execution.md)).
The hosted Server owns its state in PostgreSQL and the App talks to it directly
over tRPC HTTP and WebSocket.

## Applications

| Application | Entrypoint | Owns |
| --- | --- | --- |
| Grotto Server | `src/grotto-server.ts` | tRPC, collaboration, delivery, attachment bytes, and PostgreSQL |
| Grotto App | `apps/website` | Web UI plus the optional Electron native shell |
| Grotto Computer | `apps/computer` | Local Agent execution and one isolated attachment per Server |

The App calls the Server. Each Computer opens an outbound attachment socket to
the Server. The App and Computer never connect directly. Legacy local-owner
Runtime procedures are not part of the hosted transport.

## Identity

Clerk authenticates humans and nothing more. A verified session token's subject
is the external reference used to find the stable Grotto User. Clerk
Organizations and Clerk role claims are never read and carry no authority.

Authentication carries that subject for one request only. It never publishes
the token to shared process state, so concurrent humans cannot bleed into each
other. Computers authenticate with their own Server-scoped credentials, never
with a human Clerk session.

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
| `computers` / `computer_setup_approvals` | Server-scoped Computer credentials (hash only), one-use expiring browser approvals, last authenticated handshake facts, and attachment-visible update progress |
| `server_invitations` | Email-bound, single-use invitations by SHA-256 token hash |
| `chats` | Server-owned Channels, canonical sorted two-human DMs, Owner↔Agent DMs (`dm_agent_id`), and hidden child Threads |
| `channel_participants` | One human's participation in one Channel |
| `thread_follows` | Per-human Thread attention; never membership |
| `agents` / `channel_agent_participants` | Hosted Agent identity, immutable Computer assignment, Server-owned desired runtime/model, the Computer-reported effective snapshot, and Channel access for reminder authorship |
| `agent_delivery` / `agent_pending_work` | One-row-per-Agent Stop flag and single in-flight run (the per-Agent serialization boundary), and the durable pending inbox drained into runs |
| `agent_turns` | Compact per-run turn summary reported by a Computer after a launch settles |
| `chat_messages` | Immutable human or reminder-system messages ordered by per-Chat sequence and nonce |
| `chat_reads` | One monotonic reader high-water mark per Chat |
| `chat_events` | Durable message/read/task/reminder-change events ordered by PostgreSQL cursor |
| `attachments` | Server/Chat-scoped metadata, upload state, content digest, and optional message association |
| `message_tasks` | Lifecycle metadata keyed directly to one canonical hosted message |
| `task_labels` / `message_task_labels` | Small Server task-label catalog and task links |
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

## Computer attachment

`grotto-computer setup /<slug>` creates an expiring browser approval and holds its
temporary secret only in memory. An Owner or Admin approves exactly once; the
Server stores only the hash of the Computer-generated Server credential. A
re-run validates that credential and fails closed if it was revoked. The
Computer keeps its attachment record under `~/.grotto/computer`, separate from
the standalone executable at `~/.local/bin/grotto-computer`, and its resident
launchd service reconnects through the single outbound
`/computer/attachment` socket.

Every socket starts with bootstrap protocol version 1. The authenticated
`bootstrap` frame carries only Computer product/protocol facts and shared update
progress. The Server admits ordinary reports, delivery, and control only when
the ordinary protocol is version 3. An incompatible Computer stays connected
as `update-required`: signed update control remains available, while inventory,
Agent delivery, and MCP control fail closed. A Computer that cannot send the
stable bootstrap frame is rejected and must be repaired with
`grotto-computer upgrade`; there is no old ordinary-protocol fallback.

Update progress is stored per attachment in `computers` and refreshed from the
shared Computer-local update record, so every attached Server sees the same
phase without receiving the initiating User or Server identity. Download and
signature verification run while turns may continue. `waiting-for-agents`
closes local and Server admission, waits for every active-run marker to clear
without a deadline, then the verified standalone executable atomically replaces code and the
resident service restarts every attachment runner. Queued Server work drains
after reconnect.

Only Owners and Admins can approve or view Computers. The Server never opens
an inbound Computer connection and never receives a human login session from a
Computer.

Every compatible Computer also reports a sanitized provider-usage snapshot
after attaching and once per minute. The Server stores the latest snapshot and
its receipt time on that Computer row. All Server members can read these Stats,
including when the Computer is offline; Computer inventory and lifecycle
management remain Owner/Admin-only.

## Agent configuration

A Computer's attachment socket reports a sanitized runtime/model inventory —
ids and labels only, never provider credentials — stored on
`computers.reported_inventory` and replaced wholesale on each report.
Computer runtime discovery uses a deterministic service search path that
includes inherited entries plus common Homebrew, local-user, and system binary
directories. Each CLI is resolved to an absolute path and must pass a bounded
version probe; Agent launch receives that same resolved environment, so
advertised and runnable runtimes do not diverge. Creating
an Agent (`agent.create`, Owner/Admin) binds it to exactly one attached
Computer plus a runtime and model that exist in that Computer's last-reported
inventory, then opens the ordinary Owner↔Agent DM; there is no onboarding
Channel. The Server owns that **desired** configuration; the Computer reports
**effective** state. `agent.configure` changes desired runtime/model on the
same Computer — the assignment is immutable and absent from the input — and
validates only against that Computer's inventory, so desired edits saved while
the Computer is offline still fail closed on a cross-Computer or unreported
reference. A referenced runtime or model that is absent is rejected; the Server
never substitutes another. The Server sends the full desired executor snapshot
after create/configure and on every Computer reconnect. The Computer resolves
and durably records it before any first turn, then reports either the exact
effective pair or explicit missing resources. `agent.list` derives status per Agent: `pending`
until a reported effective snapshot matches desired, `applied` once it matches
with nothing missing, and `degraded` when the Computer reports missing local
resources. Effective reports (`record-agent-effective-state`) only touch rows
whose `computer_id` is the reporting Computer, so cross-Computer effective
claims update nothing. See
[Agent desired and effective configuration](../../specs/agent-desired-effective-config.md).

## Agent skills

Each Agent's assigned Computer owns one canonical skill library for that Agent.
Ordinary Computer reports add compact host-source and Agent-library metadata to
the sanitized inventory stored in `computers.reported_inventory`; skill content
and operator-global execution remain local. An Owner/Admin `agent.importSkill`
request validates the source against that Computer's last report, then asks the
online Computer to make one independent atomic copy in the assigned Agent's
library. Imports wait for the Agent's current turn to settle and affect the next
turn only. Native skill paths and harness injection resolve to the same library.
See [Skills](../features/skills.md) and [Skills API](../api/skills.md).

`apps/server/src/postgres/bootstrap.ts` is the schema of record — fresh-schema
DDL applied by the explicit bootstrap command before the application starts.
`schema.ts` describes the same tables for typed queries. The Server application
role has table DML authority but no DDL authority. There is no migration history
or tooling.

## Durable Agent delivery

The Server owns Agent delivery durably (`apps/server/src/agent-delivery/`), so
work survives socket loss, a Server or Computer restart, a busy turn, and a
persistent human Stop without losing or duplicating model-visible work. A human
DM message enqueues one `agent_pending_work` row **inside the same transaction
that commits the message**, so a committed message can never leave its wake
unqueued; the send never dispatches a turn itself, and the wire nudge afterwards
is best-effort because the retry sweep and reconnect recover it. `agent_delivery`
holds one row per Agent — the Stop flag plus the single in-flight run — and is
the serialization boundary: one Agent runs one turn at a time while different
Agents on one Computer dispatch concurrently, with no Computer-wide queue.

A dispatch, taken under the Server row lock, drains one chat's queued rows —
never a mix of chats — into a run bound to that chat, freezes its prompt, and
sends a typed `start` down the Computer's attachment socket; other chats drain in
their own later runs. The Computer replies with a content-free `ack` (local
acceptance, not model visibility). An unacknowledged run is what the retry sweep
resends; a reconnecting Computer additionally has every in-flight run resent —
acknowledged or not — because it may have lost its live turn. Resends always
reuse the same `run_id`, so duplicate delivery is idempotent: the Computer
reserves a run synchronously before any marker I/O and dedupes against a
restart-durable per-run marker under `~/.grotto/computer`, replaying a settled
run's stored summary instead of re-running it. A busy Agent accumulates queued
work and receives a content-free `notice` (a count only), recorded in the running
turn's runtime directory; that work becomes model-visible only at the next safe
boundary, when the turn settles and the Server drains it into a fresh run. A
completed turn deletes its claimed rows; a failed or Stopped turn requeues them,
so nothing is lost. A failed turn does not re-drive immediately — repeated
failures back off (`retry_after`) and then degrade (`consecutive_failures`
reaches its cap), so a broken runtime cannot tight-loop; fresh human intent
(a new message or Start) clears the backoff.

Human Stop/Start (`agent.stop` / `agent.start`, Owner/Admin) is persistent: Stop
sets the durable flag, **revokes the live run's runner credential so the Stop
holds even when the Computer is offline or restarts and re-runs the turn**, kills
the live turn with a best-effort `stop` frame, requeues its work, and suppresses
further wakes while work keeps accumulating; Start clears the flag and any backoff
and drains the pending inbox into the current session. `agent.deliveryState` reads
the Stop flag, whether a turn is running, and the queued count.

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
that transaction. Script text is opaque, size-bounded delivery data. The
assigned Computer executes it once in the Agent workspace with a timeout and a
restart-durable result marker. Empty success stays quiet; output or failure is
recorded on the fire, appended as a reminder-authored message, and delivered to
the Agent. Offline script attention is resent on Computer reconnect.

`/healthz` reports only the scheduler's redacted state and safe timestamps.
Shutdown stops new ticks and awaits any in-flight tick before closing
PostgreSQL. Pending attention remains durable across Server and Computer
shutdown. Ordinary attention clears after a completed Agent turn sees it;
script attention clears after the matching Computer result settles.

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
- `task.*` resolves current membership and parent-Chat access. Assignment also
  requires Owner/Admin authority and filters targets to active humans with that
  same parent-Chat access and membership stint. Task writes lock the Server
  before authorizing, then serialize versioned changes against the task row.
- Membership removal releases the departing human's task claims and
  assignments with durable task events. Reinvitation restores neither those
  links nor private task/Thread access from the former stint.
- Durable delivery skips inaccessible Chats without ending the Server feed.
  Revoked Server membership ends delivery.

A human without membership gets `FORBIDDEN`; an address with no Server gets
`NOT_FOUND`. App-side checks are presentation only.

## App surface

- `/` signs the human in, then opens the last Server they used or their first
  current membership. Server switching and creation live in the App sidebar.
- `/s/<slug>` opens Server-owned Chats, transcript, composer, reads, search,
  attachments, and the hosted task Board/List. It reserves and streams local
  files to the hosted Server, renders only attachment metadata in messages,
  and performs authenticated downloads.
  An author already visible in the transcript is the entry point for their DM.
  Message replies open hidden child Threads in the resizable side pane; Threads
  never enter the hosted sidebar Chat list.
  Task rows open the canonical message's existing child Thread. Task controls
  call the hosted API directly; durable task events own exact cache invalidation.
- `/s/<slug>/members` manages humans and invitations.
- `/s/<slug>/computers` is the Owner/Admin Computer inventory. It shows
  attachment health, reported runtimes/models, assigned Agents, update state,
  recovery commands, and removal. Computer reports invalidate this inventory
  and Agent availability through the Server websocket; the App does not poll a
  Computer or connect to one directly.
- `/s/<slug>/settings/connections` manages MCP connections on one selected
  Computer attachment. Secrets relay over the Server's existing authenticated
  Computer socket and never enter App storage.
- `/s/<slug>/settings/updates` owns only the packaged desktop App update.
  Computer updates live on the selected Computer detail. The hosted App has no
  Runtime URL, token, connection banner, or Runtime update flow.
- `/invite/<token>` is where an invited human accepts. It sits outside the
  `/s/<slug>` branch because a Server address may itself be `invite` or `join`.
  Manual links use `VITE_GROTTO_APP_ORIGIN` when configured, so a packaged App
  never exposes its private `file:` URL; that origin must match `APP_ORIGIN`.
- `/privacy` serves the public privacy policy directly from the hosted App
  artifact without loading the signed-in App shell.

The App uses `apps/website/src/lib/grotto-server.tsx`: the browser's same origin
in production and `VITE_GROTTO_SERVER_ORIGIN` in development, with the Clerk
session attached per request and per WebSocket connection. Product operations
never use a local sidecar or Electron IPC. Electron supplies native window,
link, authentication-storage, and desktop-update behavior only. Hooks live in
`apps/website/src/hooks/servers/`.

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
Cloudflare owns DNS, TLS, named Tunnel ingress, and the `www`-to-apex Redirect
Rule. PostgreSQL, attachment storage, and jobs remain local to the Mac mini.
Vercel remains the registrar only and serves no production traffic. See [Grotto
Server deployment](../operations/grotto-server-deploy.md).
