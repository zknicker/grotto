---
summary: Build, install, supervise, monitor, back up, restore, cut over, and roll back the single-node Grotto Server at grotto.sh.
read_when:
  - deploying or operating the hosted Grotto Server
  - changing grotto.sh ingress, PostgreSQL roles, backups, restores, or health monitoring
  - preparing a Grotto Server release artifact
---

# Grotto Server deployment

`grotto.sh` is one Server on the Mac mini. Cloudflare provides DNS, TLS, and a
named Tunnel only. The Tunnel sends `https://grotto.sh` to
`http://127.0.0.1:18791`; the Server serves the App, tRPC HTTP, WebSocket, and
`/healthz` from that origin. PostgreSQL, attachments, and jobs stay on the mini.
There is no public inbound port, managed database, object store in the request
path, or Cloudflare compute.

## Release artifact

The hosted Server and hosted web App are one Grotto product release. Publishing
the repository's annotated `vX.Y.Z` GitHub Release promotes that exact tag to
production. A push to `main` never deploys.

The self-hosted `Deploy Grotto Server` workflow:

1. accepts the published release event, or a manual exact published `vX.Y.Z`
   with mode `deploy` or `activate`
2. rejects drafts, prereleases, lightweight tags, branches, and arbitrary SHAs
3. resolves the annotated tag to a full commit SHA through the authenticated
   GitHub API
4. in `deploy` mode, requires the exact Server archive and sidecar whose
   version and short SHA match that release
5. verifies the existing private PostgreSQL service without starting,
   recreating, migrating, or bootstrapping it
6. in `deploy` mode, downloads and checksum-verifies those two assets, extracts
   only the compiled deploy operation, and uses it to verify and install the
   immutable full-SHA release; `activate` verifies the installed release through
   the activation helper and skips asset download and installation
7. switches `current`, bootstraps the exact root-owned Server plist when its
   label is not loaded, otherwise restarts only `com.grotto.server`, and proves
   local health
8. rolls back to the exact previous SHA on failure; a failed first activation
   boots out the label it introduced before removing `current`

`productVersion` is the website version. `sourceRevision` is the full immutable
tag commit SHA. The release id is
`<productVersion>+git.<first-12-sourceRevision>`, while the installation
directory is `releases/<full-sourceRevision>`. `release.json`, the artifact
checksum, startup logs, and activation output carry the product version, full
revision, and content digest. Public `/healthz` does not.

The trusted macOS publisher supplies the non-secret
`VITE_CLERK_PUBLISHABLE_KEY` and builds the Server artifact once as part of
`release:publish`. The mini never parses a build environment, installs Bun
dependencies, resets its checkout, or rebuilds the Server. PostgreSQL and
runtime secrets do not enter the artifact, Actions inputs, environment, or
output.

The Apple Silicon archive and SHA-256 file are built under
`apps/server/release/`, verified by the publisher, and attached to the GitHub
Release. The archive contains the compiled deploy operation, Server operations,
hosted App, four Grotto launchd jobs, one narrow activation sudoers rule, shared
Colima boot assets, and safe configuration examples. The mini verifies the
outer checksum before extracting or executing the deploy operation, which then
verifies the internal manifest and release identity before atomic installation.
A manual `activate` never downloads, rebuilds, or reinterprets an artifact.
Urgent production changes require a patch release.

## Host and container ownership

The checkout remains owned by `zknicker`; service identities receive only the
traversal and read/write access their job needs:

| Identity | Owns | May read |
| --- | --- | --- |
| `_grotto_server` | `data/attachments` | `current`, `config/server.env` |
| `_grotto_backup` | `data/backup-staging`, `data/backup-state` | attachment tree, `current`, `config/backup.env`, restic key |
| `_grotto_tunnel` | no application state | `config/cloudflared.yml`, Tunnel credential |
| `_grotto_monitor` | no application state | `current`, `config/monitor.env`, backup success timestamp |

Host-only state lives under `/Users/zknicker/srv/grotto`: `.env`,
`database-roles.env`, `compose.yml`, `config/`, `data/`, `logs/`, `releases/`,
and `current`. Preserve `bin/`, `colima/`, and `operations/` when present. Put
these names in the checkout's local `.git/info/exclude`; do not commit them and
never run `git clean`. Secret files are mode `0600`, owned by the one service
identity that needs them. Service identities cannot write the checkout,
release, or activation-helper directories. The Server and PostgreSQL listen
only on loopback.

The only privileged executable is
`/usr/local/libexec/grotto/activate-grotto-server`. `/usr/local`,
`/usr/local/libexec`, `/usr/local/libexec/grotto`, and the executable are
root-owned and not group- or world-writable. The helper refuses to run from any
other path or with insecure ownership. This does not create another application
root: checkout, releases, configuration, data, and logs remain under
`/Users/zknicker/srv/grotto`.

PostgreSQL is the only Grotto container. The host-local root `compose.yml` is
installed once from the reviewed asset; routine application deploys only verify
it. The mode `0600` root `.env` contains the generated PostgreSQL admin
password. Compose project `grotto` uses the pinned
PostgreSQL 16.14 Alpine digest, container
`grotto-postgres`, named volume `grotto_postgres_data`, and
`127.0.0.1:5438:5432`. Do not add the database to Tailscale Serve or Funnel.
Administration uses SSH and local loopback. Install PostgreSQL 16 client tools
for the host backup, restore, and monitor programs without enabling a host
PostgreSQL service.

Create `data/attachments/.backup-sentinel` with random, non-secret content
before the first backup. PRD-142 owns attachment APIs; this deployment only
provisions and verifies the sentinel.

## Fresh PostgreSQL authority

The operator creates three roles:

- `grotto_bootstrap`: owns the `public` schema (or its database) and is used
  only for the one fresh bootstrap.
- `grotto_runtime`: login with `CONNECT`, schema `USAGE`, and table DML only.
- `grotto_backup`: login with `CONNECT` and read-only access needed by
  `pg_dump`.

Run bootstrap once against an empty, newly created production database:

```bash
GROTTO_DATABASE_BOOTSTRAP_URL='postgres://grotto_bootstrap:…@127.0.0.1:5438/grotto_production' \
GROTTO_DATABASE_RUNTIME_ROLE=grotto_runtime \
/Users/zknicker/srv/grotto/current/bin/grotto-server-bootstrap
```

Grant `grotto_backup` read-only access after bootstrap, then change
`grotto_bootstrap` to `NOLOGIN`. Inject the runtime URL into `server.env`.
Startup checks connectivity and does not execute DDL. There are no migrations,
adoption paths, or schema compatibility shims. Any incompatible development
state requires a separately named, manual, operator-approved recreate.

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

Install the four plists in `apps/server/launchd/` as system daemons. The Server
and named `grotto-production` Tunnel use `RunAtLoad` and `KeepAlive`. Tunnel
metrics bind to `127.0.0.1:20242`; the shared existing tunnel already owns
`20241`. Backup runs at 00:15, 06:15, 12:15, and 18:15 local time. Monitor runs
every minute and requires the explicit PostgreSQL endpoint
`127.0.0.1:5438`.

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
`postgres_unavailable` code. The monitor classifies:

- `server_unreachable`
- `postgres_unavailable`
- `tunnel_unavailable`
- `public_route_unavailable`
- `backup_stale`

Exact private Healthchecks.io ping URLs are injected in `monitor.env`; they are
never logged. Local service, PostgreSQL, Tunnel readiness, public route, and
the backup success timestamp are probed independently. A PostgreSQL-backed 503
from the Server remains a PostgreSQL failure, not a Server-process failure.

## Off-machine backup

`grotto-server-backup` takes an asynchronous custom-format `pg_dump`, stages the
attachment tree, verifies the attachment sentinel, writes SHA-256 checksums for
the dump and sentinel, and sends the snapshot to the externally configured
restic repository. Restic supplies encryption. The
six-hour job retains 28 six-hour snapshots, 14 daily, 8 weekly, and 12 monthly
snapshots, then prunes. A success timestamp is replaced atomically only after
backup and retention succeed.

The proposed destination is a dedicated Backblaze B2 bucket/prefix. The exact
repository, bucket, prefix, application key, and restic password are operator
values. Keep the B2 application key limited to that bucket and keep the restic
password in the host secret store plus the operator's separate recovery
vault. Neither value belongs in source control or process arguments.

## Isolated restore drill

Choose a specific restic snapshot. Create a new empty database and a
nonexistent restore directory outside the production attachment tree. Give the
restore role authority only over that database. Inject the exact snapshot,
isolated database, target root, and repository values into the root-owned
`restore.env`, then run:

```bash
/Users/zknicker/srv/grotto/current/operations/run-restore
```

The command refuses the production database, an existing directory, an
overlapping attachment path, or a nonempty database. It verifies the dump and
sentinel checksums before `pg_restore`. Record the snapshot id, row-count
checks, sentinel checksum, start/end time, and cleanup targets. Cleanup is a
separate, explicit operator action.

## Manual cutover

Resolve and record every exact path, identity, database, Tunnel id, DNS route,
secret source, and rollback release before changing the host.

1. Initialize or fetch the Tavern repository in place at
   `/Users/zknicker/srv/grotto`. Add every host-only root named above to
   `.git/info/exclude`; preserve existing files and never use `git clean`.
2. Confirm the self-hosted runner can read this repository and invoke the
   `Deploy Grotto Server` workflow. Do not grant it general root authority.
3. Verify the artifact checksum, host architecture, free loopback ports, and
   current service inventory.
4. Install approved PostgreSQL client, cloudflared, and restic versions without
   enabling a host PostgreSQL service.
5. Install shared system-boot Colima supervision; confirm that existing
   containers and volumes were not restarted or replaced.
6. Install the host-local root `compose.yml` and mode `0600` `.env`;
   create only the `grotto` Compose project and named database volume.
7. Create the dedicated identities, `config/`, `data/`, `logs/`, and
   `releases/` permissions, plus the attachment sentinel. Grant each service
   identity traverse-only access to `/Users/zknicker` and
   `/Users/zknicker/srv` and verify those ancestors are not group- or
   world-writable.
8. Create the fresh database and least-privilege roles; run bootstrap once,
   grant backup reads, and revoke bootstrap login.
9. Create mode `0600` runtime configuration. `config/server.env` requires the
   production database URL, `https://grotto.sh` origin, Grotto Clerk issuer,
   and Grotto production `CLERK_SECRET_KEY`; invitation acceptance needs that
   secret for verified-email lookup. Transfer it out of band and never put it
   in `.env`, Actions, logs, command arguments, or version control.
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
    before deploying a release that changes its validation contract.
11. Manually dispatch the exact published `vX.Y.Z` in `deploy` mode. This seeds
    the first immutable release through the same download, verification,
    install, helper-owned Server bootstrap, health, and rollback path used by
    later published releases.
12. Inject `backup.env`, `monitor.env`, restic key, and Tunnel credential.
13. Create the named `grotto-production` Tunnel and confirm its config routes
   only to `127.0.0.1:18791`.
14. Verify the helper-loaded Server through the local App, `/healthz`,
    authenticated API, and WebSocket.
15. Load the Tunnel, approve the `grotto.sh` DNS route, then verify canonical
    sign-in, Server creation, and reopen from a remote client.
16. Run backup and the isolated restore drill; record evidence.
17. Reboot once and prove PostgreSQL, Server, Tunnel, monitor, canonical flow,
    and backup schedule recovered.

Each step needs the operator's explicit approval before the corresponding
material host or Cloudflare change. Do not delete old state or overwrite a
database.

## Rollback

Keep the previous full-SHA release and all state untouched. Activation switches
`current` atomically, restarts only `com.grotto.server`, and restores the exact
previous SHA automatically when local health fails. A manual rollback selects
an already installed published version in the Actions workflow and uses
`activate`; it never rebuilds. If a wider cutover fails, stop Tunnel ingress or
restore its previously recorded route without changing application state.
Stop the database with
`docker compose -f /Users/zknicker/srv/grotto/compose.yml -p grotto down`
without `--volumes`; preserve `grotto_postgres_data`. Never roll back PostgreSQL
by deleting or overwriting its data. Keep shared system Colima supervision in
place unless the operator separately decides to restore login-scoped recovery.
Capture redacted service status and logs before changing anything further.
When the first activation has no previous release, failure instead boots out
the Server label introduced by that attempt before removing `current`. A
bootout failure leaves `current` on the failed release for diagnosis and
requires operator intervention. If the label was already loaded, failure also
leaves `current` intact because the helper did not introduce that label. Neither
path claims rollback or creates a missing-`current` restart loop.
