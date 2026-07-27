---
summary: Production Grotto Runtime deployment for a Mac mini using the runtime CLI, Homebrew service management, runtime URL configuration, and trusted-network assumptions.
read_when:
  - deploying Grotto Runtime to a Mac mini or always-on host
  - changing runtime CLI commands, Homebrew service packaging, runtime host/port defaults, or app runtime URL setup
  - changing how a deployed host runs local agent execution
  - separating Grotto desktop app releases from Grotto Runtime releases
---

# Runtime Deployment

Grotto Runtime is an always-on server process. The desktop app connects to its
configured Runtime URL.

## Grotto Computer Recovery

Grotto Computer is the separate local execution service introduced by the
hosted Server split. Its normal signed production update starts from an
Owner/Admin Computer settings page. If the installed binary cannot speak the
stable bootstrap protocol, repair it locally:

```bash
grotto-computer upgrade
```

The command downloads the same latest-production descriptor as Settings,
verifies its Ed25519 signature and tarball SHA-256, waits indefinitely for
active Agent turns, replaces only the npm-installed code, and restarts the
resident service plus every Server attachment runner. It never cleans
`~/.grotto/computer`, and it never kills a stuck Agent on a hidden timeout. Use
the explicit Owner/Admin Agent Stop control before retrying when a turn cannot
finish.

## Runtime CLI

Keep the CLI small:

```bash
grotto                 # banner, live runtime status line, command list
grotto serve
grotto status [--json] [--runtime-url <url>]
grotto claim [--clerk-key <key>] [--user <id>]
grotto token [--json]
grotto engine status
grotto engine install
grotto engine clean
grotto update [--restart] [--verbose]
grotto restart [--no-wait]
grotto --version
grotto help [command]
```

Bare `grotto` does not start the server; it prints the banner, a one-line
runtime status, and the command list. Help is generated from the command
registry: `grotto help <command>` and `--help` work on every command, bare
`grotto engine` prints group help, and unknown commands get a did-you-mean
suggestion. Exit codes are `0` success, `1` operational failure, `2` usage
error. Read commands support `--json`.

This is the operator-facing surface. Agents get a separate, per-agent
`grotto message`/`grotto inbox`/`grotto channel`/`grotto thread` CLI
authorized by an agent-token bearer credential, not the operator token — see
[Agent Inbox](../../specs/inbox.md) and [Grotto CLI](../../specs/grotto-cli.md).

`serve` runs the foreground Runtime process. It starts the Runtime HTTP and
WebSocket API, Runtime storage, Agent execution, reads, and Runtime jobs. It
logs to stdout and stderr, and exits on `SIGINT` or `SIGTERM`. The Homebrew
service and the dev launchd plist invoke `grotto serve` explicitly.

`status` is the one-screen host health view: Homebrew service state, the
running Runtime version versus the installed binary version (including the
"staged, run 'grotto restart'" case), capability health with reasons, and the
resolved engine. With `--runtime-url` it inspects a remote Runtime; the
local-only rows are then labeled `(local)` and the staged-binary hint is
suppressed.

`grotto` is the CLI. `grotto-runtime` is the service binary.

`engine` commands report and manage local agent-execution readiness without
needing a running Runtime. `status` shows resolved runtime paths, configured
providers, and installed dependencies.
`install` prepares the agent home under `~/.grotto/runtime/agent/`
(idempotent; streams installer output). `clean` removes engine installs for
other pins; `--all` removes every install.

`update` shells out to Homebrew and stages the newest Runtime package without
restarting the running service, then best-effort pre-installs the staged
Runtime's pinned engine so the cutover restart does not wait on an engine
download. It prints phase progress for Homebrew checks, package staging, engine
pre-stage, and version checks; `--verbose` also prints captured Homebrew output.
It always ends with a version verdict: it compares the staged binary version
against the running Runtime and says explicitly when a restart is still required
("formula up to date" never implies the running process is). `--restart`, or a
confirmation prompt on a TTY, cuts over immediately.
`restart` restarts the Homebrew service, waits for Runtime health, and
confirms the new running version; it never reports success without observing
health (`--no-wait` skips the wait). Use Homebrew directly for stop, logs, and
boot persistence.

Runtime updates are two-phase:

1. **Stage.** Grotto installs the new Runtime package while the old Runtime
   process stays online.
2. **Cut over.** Grotto restarts Runtime only after the desktop update is also
   ready, then waits for Runtime health before restarting the app when an app
   update is staged.

This keeps Runtime-backed features online during download/install work and
prevents the old app from sitting against a newly restarted incompatible
Runtime.

## Homebrew Service

On the Mac mini, installing Runtime through Homebrew is the install step. The
first start initializes Runtime storage and local agent workspaces:

```bash
brew install zknicker/grotto/grotto-runtime
brew services start grotto-runtime
```

The formula should run:

```bash
grotto serve
```

Use Homebrew for lifecycle:

```bash
brew services stop grotto-runtime
brew services restart grotto-runtime
brew upgrade grotto-runtime
```

Or use the Grotto CLI wrappers:

```bash
grotto update
grotto restart
```

## Configuration

Runtime defaults to local-only binding:

```bash
TAVERN_RUNTIME_HOST=127.0.0.1
TAVERN_RUNTIME_PORT=18790
TAVERN_RUNTIME_ROOT=~/.grotto/runtime
```

For a server that accepts app connections from another machine, set the host in
the service environment:

```bash
TAVERN_RUNTIME_HOST=0.0.0.0
TAVERN_RUNTIME_PORT=18790
```

The app stores a Runtime URL such as:

```txt
http://mac-mini.local:18790
```

Grotto does not enforce a network topology. Operators can use LAN DNS,
Tailscale, a reverse proxy, or another trusted network path.

Change `TAVERN_RUNTIME_PORT` only when the app Runtime URL uses the same port.

## Version Match

Grotto App and Grotto Runtime do not need exact release-version lockstep. The
app declares its Runtime compatibility floor in `apps/website/package.json` at
`tavern.runtime.minimumVersion`.

The app accepts a Runtime when the Runtime version is exactly the app version,
or when it is in the same Runtime API epoch as the floor and is greater than or
equal to the floor. The Runtime API epoch is `major.minor`; patch releases inside
that epoch are compatible unless a release raises the floor.

The app blocks normal dashboard use only when the connected Runtime is below the
floor or from a different Runtime API epoch. The onboarding-style Runtime screen
shows the app version, the minimum Runtime version, and the connected Runtime
version. The updater control stages any required Runtime update first, downloads
the app update when needed, then exposes one restart action for the final
cutover.

## Trust Model

Every non-health Runtime HTTP request and WebSocket upgrade requires a bearer
token. Grotto Runtime generates the token on first start and stores it in the host
config file `<runtime-root>/grotto.json` (`token` key, mode 0600). The Grotto App reads the token
from the connection record and sends it as `Authorization: Bearer <token>` on
every request.

**Override**: set `TAVERN_RUNTIME_TOKEN` in the Runtime process environment to
use a fixed token instead of the file-backed one. Set the same value in the App
Server environment as `TAVERN_RUNTIME_TOKEN` so the server can authenticate.
The dev stack and e2e harness set a shared token automatically.

The health route (`GET /health`) remains unauthenticated so the app can probe
reachability before pairing.

### Pairing the app to a remote Runtime

When the Runtime host is separate from the machine running the Grotto app (for
example a Mac mini on Tailscale), pair them by copying the token from the host
to the app:

1. On the Runtime host, run:
   ```bash
   grotto token
   ```
   The command prints the current bearer token — the same value Runtime enforces.
2. In the Grotto app, paste the token into the **Runtime token** field in
   **Settings → Grotto Runtime**, or during the onboarding flow when first
   connecting to a remote Runtime.

The token is stable unless you rotate it manually by editing the `token` key
in `<runtime-root>/grotto.json` (or deleting the file to regenerate). A URL-only re-save in the app does not
clear a stored token; only entering a new token value changes it.

## Release Artifact

Runtime releases produce a standalone tarball:

```txt
grotto-runtime-<version>-aarch64-apple-darwin.tar.gz
```

The release publisher uploads that tarball and its checksum beside the desktop
updater artifacts under `TAVERN_RELEASE_S3_URI`. The formula URL uses the same
public `TAVERN_RELEASE_BASE_URL`.

`release:publish` updates `zknicker/homebrew-grotto` by default. Set
`TAVERN_HOMEBREW_TAP_REPO` to publish to another tap, or
`TAVERN_HOMEBREW_TAP_DIR` to update an existing local checkout.

The Homebrew tap is maintained as part of Grotto. Runtime deployment changes in
this repository must keep the tap formula and tap README current in the same
release work.

The tarball contains:

```txt
bin/grotto-runtime
bin/grotto
share/grotto/node_modules/@tavern/sdk/
share/grotto/node_modules/@tobilu/qmd/
share/grotto/node_modules/agent-browser/
share/grotto/runtime-assets/
share/grotto/runtime-assets/google/oauth-client.json
```

`runtime-assets/google/oauth-client.json` is generated during Runtime artifact
builds from `TAVERN_GOOGLE_OAUTH_CLIENT_ID` and
`TAVERN_GOOGLE_OAUTH_CLIENT_SECRET`. The Homebrew tap formula installs
`runtime-assets/` from the tarball but does not contain the OAuth values.
