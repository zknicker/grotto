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

From a clean, verified checkout:

```bash
VITE_CLERK_PUBLISHABLE_KEY='<exact Clerk publishable key>' \
bun run build:grotto-server-artifact
```

The versioned Apple Silicon archive and SHA-256 file are written under
`apps/server/release/`. It contains five compiled programs, the hosted App, the
PostgreSQL Compose file, four Grotto launchd jobs, shared Colima boot
supervision, operation wrappers, and safe configuration examples. The Clerk
publishable key is an external, non-secret build value and is required so the
hosted App can sign in. Install a release under
`/opt/grotto-server/releases/<version>` and atomically point
`/opt/grotto-server/current` at it. On every upgrade, compare and copy the
release `compose.yml` into `/Users/zknicker/srv/grotto` before starting the new
image. Do not build on the production host.

## Host and container ownership

Create these dedicated service identities and roots only after operator
approval:

| Identity | Owns | May read |
| --- | --- | --- |
| `_grotto_server` | `/var/db/grotto-server/attachments` | `server.env` |
| `_grotto_backup` | backup staging/state | attachment tree, `backup.env`, restic key |
| `_grotto_tunnel` | no application state | Cloudflare credential and config |
| `_grotto_monitor` | no application state | `monitor.env`, backup success timestamp |

Use root-owned release files and `/Library/Application Support/Grotto/Server`.
Secret files are mode `0600`, owned by the one service identity that needs them;
configuration directories are not group- or world-writable. Logs live in
`/var/log/grotto-server`. The Server and PostgreSQL listen only on loopback.

PostgreSQL is the only Grotto container. Install `compose.yml` under
`/Users/zknicker/srv/grotto`, copy `config/postgres.env.example` to
`/Users/zknicker/srv/grotto/.env`, inject the generated admin password, and set
the file to mode `0600`. Run it as Compose project `grotto`. It uses the pinned
PostgreSQL 16.14 Alpine digest, container
`grotto-postgres`, named volume `grotto_postgres_data`, and
`127.0.0.1:5438:5432`. Do not add the database to Tailscale Serve or Funnel.
Administration uses SSH and local loopback. Install PostgreSQL 16 client tools
for the host backup, restore, and monitor programs without enabling a host
PostgreSQL service.

Create `/var/db/grotto-server/attachments/.backup-sentinel` with random,
non-secret content before the first backup. PRD-142 owns attachment APIs; this
deployment only provisions and verifies the sentinel.

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
/opt/grotto-server/current/bin/grotto-server-bootstrap
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
sudo /opt/grotto-server/current/operations/install-colima-boot
```

The daemon runs the existing `ensure-colima.sh` profile as `zknicker` at boot
and every minute. The check exits immediately while Colima is healthy and
restarts the existing profile if it stops. Installing it persistently disables
and unloads only the duplicate user job; it does not stop Colima or restart
containers. If installation fails, the operation removes its partial daemon,
re-enables the preserved user job, and reloads it when a GUI session exists.
Roll back this shared host change independently with:

```bash
sudo /opt/grotto-server/current/operations/rollback-colima-boot
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
/opt/grotto-server/current/operations/run-restore
```

The command refuses the production database, an existing directory, an
overlapping attachment path, or a nonempty database. It verifies the dump and
sentinel checksums before `pg_restore`. Record the snapshot id, row-count
checks, sentinel checksum, start/end time, and cleanup targets. Cleanup is a
separate, explicit operator action.

## Manual cutover

Resolve and record every exact path, identity, database, Tunnel id, DNS route,
secret source, and rollback release before changing the host.

1. Verify the artifact checksum, host architecture, free loopback ports, and
   current service inventory.
2. Install approved PostgreSQL client, cloudflared, and restic versions without
   enabling a host PostgreSQL service.
3. Install shared system-boot Colima supervision; confirm that existing
   containers and volumes were not restarted or replaced.
4. Install `/Users/zknicker/srv/grotto/compose.yml` and its mode `0600` `.env`;
   create only the `grotto` Compose project and named database volume.
5. Create the dedicated identities, roots, permissions, log paths, and sentinel.
6. Create the fresh database and least-privilege roles; run bootstrap once,
   grant backup reads, and revoke bootstrap login.
7. Install the release and inject `server.env`, `backup.env`, `monitor.env`,
   restic key, and Tunnel credential.
8. Create the named `grotto-production` Tunnel and confirm its config routes
   only to `127.0.0.1:18791`.
9. Load the Server; verify local App, `/healthz`, authenticated API,
   and WebSocket.
10. Load the Tunnel, approve the `grotto.sh` DNS route, then verify canonical
   sign-in, Server creation, and reopen from a remote client.
11. Run backup and the isolated restore drill; record evidence.
12. Reboot once and prove PostgreSQL, Server, Tunnel, monitor, canonical flow,
    and backup schedule recovered.

Each step needs the operator's explicit approval before the corresponding
material host or Cloudflare change. Do not delete old state or overwrite a
database.

## Rollback

Keep the previous release and all state untouched. If application verification
fails, stop Tunnel ingress or restore its previously recorded route, point
`current` back to the prior release, and restart only the affected daemon.
Stop the database with
`docker compose -f /Users/zknicker/srv/grotto/compose.yml -p grotto down`
without `--volumes`; preserve `grotto_postgres_data`. Never roll back PostgreSQL
by deleting or overwriting its data. Keep shared system Colima supervision in
place unless the operator separately decides to restore login-scoped recovery.
Capture redacted service status and logs before changing anything further.
