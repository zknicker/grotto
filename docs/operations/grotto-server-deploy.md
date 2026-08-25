---
summary: Build, install, supervise, back up, restore, cut over, and roll back the single-node Grotto Server at grotto.sh.
read_when:
  - deploying or operating the hosted Grotto Server
  - changing grotto.sh ingress, PostgreSQL roles, or the delivered Server environment
  - preparing a Grotto Server release artifact
---

# Grotto Server deployment

`grotto.sh` is one Server on the Mac mini. Cloudflare provides DNS, TLS, and a
named Tunnel only. The Tunnel sends `https://grotto.sh` to
`http://127.0.0.1:18791`; the Server serves Grotto App, tRPC HTTP, WebSocket, and
`/healthz` from that origin. A Cloudflare Redirect Rule sends
`www.grotto.sh/*` to the matching apex path and preserves the query string.
PostgreSQL, attachments, and jobs stay on the mini. There is no public inbound
port, managed database, object store in the request path, or Cloudflare compute
for the apex. Vercel remains the domain registrar only; no production request
or deployment uses Vercel.

## Release artifact

The Server and Grotto App are one Grotto Server release. Publishing the
repository's annotated `vX.Y.Z` GitHub Release makes that tag *deployable*; a
manual `Deploy Grotto Server` dispatch is what promotes it. Neither a push to
`main` nor publishing a Release deploys on its own — a deploy resolves
production credentials from 1Password and rewrites the Server's delivered
environment, so it is an explicit act.

The self-hosted `Deploy Grotto Server` workflow:

1. accepts a manual exact published `vX.Y.Z` with mode `deploy` or `activate`
2. rejects drafts, prereleases, lightweight tags, branches, and arbitrary SHAs
3. resolves the annotated tag to a full commit SHA through the authenticated
   GitHub API
4. in `deploy` mode, requires the exact Server archive and sidecar whose
   version and short SHA match that release
5. verifies the existing private PostgreSQL service without mutating it
6. in `deploy` mode, downloads and checksum-verifies those two assets, extracts
   only the compiled deploy operation, and uses it to verify and install the
   immutable full-SHA release; `activate` verifies the installed release and
   skips asset download and installation
7. renders `config/server.env` from the workflow revision's `.env.schema` under
   `varlock run`, mode `0600` plus one ACL entry granting `_grotto_server` read,
   after proving the released Server reads exactly the names that contract
   delivers, retrying a transient 1Password failure up to three times because
   resolving is idempotent
8. runs the candidate's migration program under `varlock run`, with the
   migration credential resolved from 1Password, and records the exact
   successful migrations in the job summary
9. switches `current`, bootstraps the exact root-owned Server plist when its
   label is not loaded, otherwise restarts only `com.grotto.server`, and proves
   local health
10. reads the delivered environment back names-only and fails on a name outside
    the delivered set, or on a production-required name of that set arriving
    missing or empty
11. rolls back to the exact previous SHA on failure; a failed first activation
    boots out the label it introduced before removing `current`

`productVersion` is the website version. `sourceRevision` is the full immutable
tag commit SHA. The release id is
`<productVersion>+git.<first-12-sourceRevision>`, while the installation
directory is `releases/<full-sourceRevision>`. `release.json`, the artifact
checksum, startup logs, and activation output carry the product version, full
revision, and content digest. Public `/healthz` does not.

The trusted macOS publisher builds the Server artifact once as part of
`release:publish`; the non-secret `VITE_CLERK_PUBLISHABLE_KEY` it inlines is a
public literal in `.env.schema`. The mini never installs Bun dependencies,
resets the deploy root, or rebuilds the Server. PostgreSQL and runtime secrets
do not enter the artifact, Actions inputs, or output — they resolve from
1Password during the deploy and land only in `config/server.env`. See
[environment.md](environment.md).

The Apple Silicon archive and SHA-256 file are built under
`apps/server/release/`, verified by the publisher, and attached to the GitHub
Release. The archive contains the compiled deploy operation, Server operations,
Grotto App, PostgreSQL migration runner and files, two Grotto launchd jobs, one
narrow activation sudoers rule, and shared Colima boot assets. It ships no
environment example of any kind: `config/server.env` is rendered from the
schema at deploy time. The mini verifies the
outer checksum before extracting or executing the deploy operation, which then
verifies the internal manifest and release identity before atomic installation.
A manual `activate` never downloads, rebuilds, or reinterprets an artifact.
Urgent production changes require a patch release.

## Where the contract comes from

The environment contract travels with the repository, not with the artifact.
The deploy job checks out its **own** revision — not the released one — with
full history, and renders `config/server.env` from that `.env.schema`.

That is not a convenience. The release being deployed may predate the contract
entirely: the first varlock deploy necessarily promotes a version built before
`.env.schema` existed, and so does every rollback to one. A job that took its
contract from the artifact could never run the first time.

The cost is that the two revisions can disagree, and a silent disagreement is
worse than a failed deploy: a Server that cannot find `GROTTO_CLERK_SECRET_KEY`
because it was built when the name was `CLERK_SECRET_KEY` does not crash — it
falls back to its own defaults and serves production without a Clerk secret and
against the wrong database. So the render step reads the released revision's own
`apps/server/src/config/env.ts` out of git history and refuses to render unless
the name sets match exactly, naming both sides of the drift when they do not.
Post-bootstrap the two revisions normally agree and the check is a no-op.

A release whose Server reads a different name set than the current contract
delivers cannot be deployed through this path. Cut a release from a revision
whose contract matches, or place `config/server.env` by hand before activating
that release.

## Host and container ownership

The checkout remains owned by `zknicker`; service identities receive only the
traversal and read/write access their job needs:

| Identity | Owns | May read |
| --- | --- | --- |
| `_grotto_server` | `data/attachments` | `current`, `config/server.env` |
| `_grotto_tunnel` | no application state | `config/cloudflared.yml`, Tunnel credential |

Host-only state lives under `/Users/zknicker/srv/grotto`: `config/`, `data/`,
`logs/`, `releases/`, and `current`. Preserve `bin/`, `colima/`, and
`operations/` when present. Put these names in the deploy root's local
`.git/info/exclude`; do not commit them and never run `git clean`.

The deploy root must contain **no** `.env`. Varlock loads a checkout `.env`
above `.env.schema`, and a `$` in any of its values is parsed as an expression;
the deploy job refuses to run when one exists. `config/server.env` is written
by the deploy job at mode `0600`, owned by `zknicker`, with one ACL entry
granting `_grotto_server` read — `config/` itself is `zknicker`-owned and
traversable so the service can reach it. The migration credential is not a
GitHub Actions secret and is not stored in the release or read by the Server: it
resolves from 1Password during the migration step only. Service identities
cannot write the deploy root, release, or activation-helper directories. The
Server and PostgreSQL listen only on loopback.

The only privileged executable is
`/usr/local/libexec/grotto/activate-grotto-server`. `/usr/local`,
`/usr/local/libexec`, `/usr/local/libexec/grotto`, and the executable are
root-owned and not group- or world-writable. The helper refuses to run from any
other path or with insecure ownership. This does not create another application
root: checkout, releases, configuration, data, and logs remain under
`/Users/zknicker/srv/grotto`.

PostgreSQL is the only Grotto container. The canonical definition is the
repository's `apps/server/compose.yml`; the deploy job verifies the running
container and brings it up from that file under `varlock run` only when it is
absent or unhealthy, so the admin password is interpolated from 1Password and
no environment file is read or written. Compose project `grotto` uses the pinned
PostgreSQL 16.14 Alpine digest, container
`grotto-postgres`, named volume `grotto_postgres_data`, and
`127.0.0.1:5438:5432`. Do not add the database to Tailscale Serve or Funnel.
Administration uses SSH and local loopback. Install PostgreSQL 16 client tools
for the host backup and restore programs without enabling a host PostgreSQL
service.

## Fresh PostgreSQL authority

The operator creates three roles:

- `grotto_bootstrap`: owns the database and its `public` schema, performs the
  one fresh bootstrap, and then acts as the deployment workflow's migration login.
  Each migration run reapplies privileges so new tables and sequences are
  immediately usable by `grotto_runtime`.
- `grotto_runtime`: login with `CONNECT`, schema `USAGE`, and table DML only.
- `grotto_backup`: read-only login every migration re-grants. The scheduled
  off-machine backup that used it is retired; the role stays so the migration
  program's privilege model is unchanged.

Run bootstrap once against an empty, newly created production database:

```bash
GROTTO_DATABASE_BOOTSTRAP_URL='postgres://grotto_bootstrap:…@127.0.0.1:5438/grotto_production' \
GROTTO_DATABASE_BACKUP_ROLE=grotto_backup \
GROTTO_DATABASE_RUNTIME_ROLE=grotto_runtime \
/Users/zknicker/srv/grotto/current/bin/grotto-server-bootstrap
```

Bootstrap and every migration grant `grotto_backup` its required read access.
Both the migration URL and the runtime URL live in the `Postgres - Grotto`
Production item and reach their consumer through `.env.schema`; neither is
stored on the host by hand. Startup
checks connectivity and never executes DDL. Before activation, the deployment
workflow runs the candidate release's compiled migration program against the
checked-in SQL under `apps/server/drizzle/postgres/`. A migration failure leaves
the previous release active and produces a failed Database entry in the workflow
summary.

Generate a migration whenever `apps/server/src/postgres/schema/` changes:

```bash
cd apps/server
bun run db:generate -- --name=<short-name>
bun run db:check
```

Review and commit the generated SQL and metadata. Never use `drizzle-kit push`
against production. Migrations are forward-only and must use expand/contract:
the old Server must remain valid after the migration because application
rollback does not reverse database changes. Destructive cleanup lands only in a
later release after every deployed Server version has stopped using the old
shape.

## Supervision and health

Colima owns PostgreSQL recovery through Compose `restart: unless-stopped`.
Replace the preserved login-scoped Colima LaunchAgent with the reviewed shared
system LaunchDaemon:

```bash
sudo /Users/zknicker/srv/grotto/current/operations/install-colima-boot
```

The daemon runs the existing `ensure-colima.sh` profile as `zknicker` at boot
and every minute. The check exits immediately while Colima is healthy and
restarts the existing profile if it stops. Installing it persistently disables
and unloads only the duplicate user job; it does not stop Colima or restart
containers. If installation fails, the operation removes its partial daemon,
re-enables the preserved user job, and reloads it when a GUI session exists.
Roll back this shared host change independently with:

```bash
sudo /Users/zknicker/srv/grotto/current/operations/rollback-colima-boot
```

Rollback returns Colima to login-scoped recovery. Because automatic login is
disabled, a cold boot then needs an interactive `zknicker` login before the
preserved LaunchAgent can start Colima. Do not couple this host-level rollback
to an ordinary Grotto release rollback. The no-reboot installation check proves
the daemon can run the existing healthy profile, but full no-login boot recovery
remains unproven until the separately approved reboot drill.

Install the two plists in `apps/server/launchd/` as system daemons. The Server
and named `grotto-production` Tunnel use `RunAtLoad` and `KeepAlive`. Tunnel
metrics bind to `127.0.0.1:20242`; the shared existing tunnel already owns
`20241`. Neither plist carries environment of its own: `run-server`
shell-sources the rendered `config/server.env` and executes the Server binary
directly, because a launchd job that re-entered Varlock would resolve the schema
again at boot under the development lifecycle.

Installing the Server plist does not load it before the next boot. Run the
initial deployment before rebooting so the privileged activation helper owns
the first bootstrap after `current` points at a verified release. It accepts
only the exact root-owned
`/Library/LaunchDaemons/com.grotto.server.plist`. If first-release health fails,
the helper boots out the label it introduced before removing `current`, leaving
no `KeepAlive` loop against a missing release. If the label was already loaded,
the helper leaves `current` intact on failure because it cannot claim ownership
of stopping that label. Later activations retain the exact previous-release
rollback.

The Server returns only `{"status":"ok"}` or the redacted
`postgres_unavailable` code.

## Off-machine backup

There is none, deliberately. The scheduled `restic` backup and its isolated
restore drill were retired: they never completed a working cycle, and Grotto is
a greenfield product with no data worth the operational surface. The
`com.grotto.backup` LaunchDaemon, the `_grotto_backup` service account, and the
restic repository and password are host state to remove; the `grotto_backup`
PostgreSQL role stays because every migration re-grants it.

Reintroducing backups means designing them from scratch — new schema items, a
new 1Password item for the repository credentials, and a proven restore drill
before the first scheduled run.

## Manual cutover

Resolve and record every exact path, identity, database, Tunnel id, DNS route,
secret source, and rollback release before changing the host.

1. Initialize or fetch the Grotto repository in place at
   `/Users/zknicker/srv/grotto`. Add every host-only root named above to
   `.git/info/exclude`; preserve existing files and never use `git clean`. The
   deploy root must hold no `.env`.
2. Confirm the self-hosted runner can read this repository and invoke the
   `Deploy Grotto Server` workflow. Do not grant it general root authority.
3. Verify the artifact checksum, host architecture, free loopback ports, and
   current service inventory.
4. Install approved PostgreSQL client and cloudflared versions without enabling
   a host PostgreSQL service.
5. Install shared system-boot Colima supervision; confirm that existing
   containers and volumes were not restarted or replaced.
6. Bring PostgreSQL up from the repository's `apps/server/compose.yml` under
   `varlock run`; create only the `grotto` Compose project and named database
   volume.
7. Create the dedicated identities, `config/`, `data/`, `logs/`, and
   `releases/` permissions, plus the attachment sentinel. Grant each service
   identity traverse-only access to `/Users/zknicker` and
   `/Users/zknicker/srv` and verify those ancestors are not group- or
   world-writable.
8. Create the fresh database and least-privilege roles; run bootstrap once,
   grant backup reads, and store the runtime URL, migration URL, and container
   admin password in the `Postgres - Grotto` Production 1Password item.
9. Own `config/` as `zknicker`, mode `0755`, so the deploy job can write
   `config/server.env` and `_grotto_server` can traverse to it. That file is
   rendered by the deploy job, never by hand: it carries the production
   database URL, the `https://grotto.sh` origin, the Grotto Clerk issuer, and
   the Grotto production `GROTTO_CLERK_SECRET_KEY`, which invitation acceptance needs
   for verified-email lookup. Every one of those values lives in 1Password and
   reaches the host only through `varlock run`.
10. Build the approved release once, then install its
    `bin/activate-grotto-server` as root-owned mode `0755` at
    `/usr/local/libexec/grotto/activate-grotto-server`. Verify every path
    component named above is root-owned and not writable by `zknicker` or the
    deploy runner. Validate and install
    `host-services/grotto-server-activation.sudoers` as root-owned mode `0440`;
    it names only that exact executable; the helper enforces the full-SHA
    argument contract. This is the runner's only NOPASSWD command. Install
    reviewed launchd plists separately; ordinary release workflows never update
    these privileged assets. Reinstall the helper through this operator gate
    only when its activation or validation contract changes.
11. Manually dispatch the exact published `vX.Y.Z` in `deploy` mode. This seeds
    the first immutable release through the same download, verification,
    install, helper-owned Server bootstrap, health, and rollback path used by
    later published releases.
12. Inject the Tunnel credential.
13. Create the named `grotto-production` Tunnel and confirm its config routes
   only to `127.0.0.1:18791`.
14. Verify the helper-loaded Server through the local App, `/healthz`,
    authenticated API, and WebSocket.
15. Load the Tunnel, approve the `grotto.sh` DNS route, then verify canonical
    sign-in, Server creation, and reopen from a remote client.
16. Reboot once and prove PostgreSQL, Server, Tunnel, and the canonical flow
    recovered.

Each step needs the operator's explicit approval before the corresponding
material host or Cloudflare change. Do not delete old state or overwrite a
database.

## Rollback

Keep the previous full-SHA release and all state untouched. Activation switches
`current` atomically, restarts only `com.grotto.server`, and restores the exact
previous SHA automatically when local health fails. `config/server.env` is
rendered before activation and is *not* reverted by a rollback: the rolled-back
release runs with the new release's delivered environment. That is safe as long
as a rename lands together with the code that reads it — which is what
`env:contract` enforces — but a release that renames a variable should be rolled
back by dispatching `deploy` on the previous version rather than `activate`. A manual rollback selects
an already installed published version in the Actions workflow and uses
`activate`; it never rebuilds. If a wider cutover fails, stop Tunnel ingress or
restore its previously recorded route without changing application state.
Stop the database with `docker compose -p grotto down` without `--volumes`;
preserve `grotto_postgres_data`. Never roll back PostgreSQL
by deleting or overwriting its data. Keep shared system Colima supervision in
place unless the operator separately decides to restore login-scoped recovery.
Capture redacted service status and logs before changing anything further.
When the first activation has no previous release, failure instead boots out
the Server label introduced by that attempt before removing `current`. A
bootout failure leaves `current` on the failed release for diagnosis and
requires operator intervention. If the label was already loaded, failure also
leaves `current` intact because the helper did not introduce that label. Neither
path claims rollback or creates a missing-`current` restart loop.
