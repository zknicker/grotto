---
summary: Local development workflow for Server, Computer, app startup, and verification.
read_when:
  - running Grotto locally or changing the managed development stack
  - changing local stack startup, ports, or developer verification
  - running or verifying the iPhone app in Simulator against a local Server
---

# Development

## Worktree Setup

Run the checked-in setup command in every fresh checkout or worktree:

```bash
bun run setup:worktree
```

It installs the frozen Bun dependency graph with lifecycle scripts still
disabled, then explicitly runs only the pinned HeroUI React Pro downloader.
Local authentication comes from `bunx heroui-pro@latest login` and the system
keychain. CI or another non-interactive environment must provide
`HEROUI_AUTH_TOKEN`. Codex worktrees run this command through their environment
setup hook, and Claude Code runs it from the repository's `SessionStart` hook.
A cold worktree install moves multiple gigabytes, so that hook allows a long
timeout; cutting it short leaves the HeroUI bootstrap package in place without
its downloaded artifacts.

`bun run dev` refuses to start when those artifacts are missing. Vite otherwise
caches a broken `@heroui-pro/react` resolution that outlives a restart, so
rerun `bun run setup:worktree` and start the stack again.

## Local Stack

Run the managed development stack:

```bash
bun run dev
```

This starts an isolated PostgreSQL cluster, Grotto Server,
Grotto Computer, and the website dev server. `bun run dev-app` runs the same
stack inside the Electron desktop shell. Install the PostgreSQL 16 binaries once:

```bash
brew install postgresql@16
```

Do not start a Homebrew PostgreSQL service. The dev stack owns its direct child,
chooses a private loopback port, bootstraps a fresh schema, and preserves that
worktree's data across runs. On later boots it applies any new checked-in
PostgreSQL migrations before starting Grotto Server, so an existing worktree
database stays current with main. If that migration step fails, the database
predates the checked-in migration baseline: move
`~/.tavern/dev/<worktree-id>/postgres` aside and rerun to bootstrap fresh. On first use, Server creates one demo Server with
the Agents Blippy and Tiny, avatars for them and for you, the `#all` and
`#product` Channels, starter messages, a Thread, two tasks, and one MCP
connection — enough to open any surface without hand-building data. Computer
then runs their real Agent turns using the host's Codex, Claude Code, Grok Build, or Pi
sign-in.

Seeding runs once per Server. To pick up changes to
`apps/server/src/development/seed-server.ts`, delete the demo Server row
(its Threads and messages first, since both reference it) and reload the App.

The dev stack uses worktree-isolated development state by default:

```txt
~/.tavern/dev/<worktree-id>/computer
~/.tavern/dev/<worktree-id>/postgres
~/.tavern/dev/<worktree-id>/server/attachments
```

The stack reserves a stable four-port group from the worktree path. Grotto App uses the first port
and Grotto Server uses the fourth; the middle ports remain reserved so existing worktrees keep their
URLs. Multiple worktrees can run without sharing local state.

To intentionally share one dev workspace across worktrees, run:

```bash
bun run dev:shared
```

That target defaults `TAVERN_DEV_STACK_ID` to `tavern-shared`, so every checkout
using it reads and writes `~/.tavern/dev/tavern-shared/`. When a stack id is set,
the default port group is derived from that stack id instead of the checkout
path, so the shared workspace also has one stable set of local URLs. You can set
`TAVERN_DEV_STACK_ID` before `bun run dev:shared` to choose a different shared
workspace name. Run one shared stack per shared workspace at a time.

Set `TAVERN_DEV_STACK_ID` to choose the state directory name, or
`TAVERN_DEV_PORT_BASE` to choose the first port in the four-port group:

```bash
TAVERN_DEV_STACK_ID=agent-a TAVERN_DEV_PORT_BASE=43000 bun run dev
```

That example uses ports `43000` through `43003`. Set `GROTTO_COMPUTER_DATA_ROOT`
or `GROTTO_DATABASE_URL` explicitly when a dev run
should use specific state.

`.claude/launch.json` is gitignored and generated per checkout by a
`SessionStart` hook (`dev-port --claude-launch`), so Claude Code previews use
this checkout's real website port. The `dev-port` helper and the dev stack
derive the same four-port group from the checkout path, or from
`TAVERN_DEV_STACK_ID` when it is set.

`bun run dev` and `bun run dev-app` share the same Server, Computer,
PostgreSQL, and web app, so Agent behavior matches across both.

The installed Computer keeps service output under its stable data root and
exposes local recovery checks:

```bash
grotto-computer status
grotto-computer doctor
grotto-computer logs 200
```

`status` reads the stopped/running state for each attachment, `doctor` checks
private local files plus Server credential acceptance without printing secrets,
and `logs` tails the resident service log.

For login and setup failures, start with `grotto-computer status`. An expired or
abandoned device code is not resumed; rerun `setup /<server-slug>` for a new code.
A saved wrong account or origin requires `grotto-computer login --replace`, then
setup again. **Signed in — finishing the connection** means browser approval
succeeded but durable local attachment storage has not; leave the page open and
rerun the same setup command if the CLI stopped. Its persisted idempotency key
recovers the issued Computer instead of creating another. `logout` revokes only
the human management session and stops the service; it preserves every Server
attachment and Agent workspace for an explicit later `start`.

## Grotto For iPhone In Simulator

The iPhone app signs in automatically against a local Server, the same way the
website does in development. It never needs browser OAuth or hand-entered
credentials.

Start the stack, then build, install, and launch the app with the development
environment:

```bash
bun run dev
```

```bash
cd apps/ios-swift && xcodegen generate --spec project.yml
```

```bash
xcrun simctl boot "iPhone 17 Pro"; xcrun simctl bootstatus "iPhone 17 Pro"
```

```bash
xcodebuild -project apps/ios-swift/Grotto.xcodeproj -scheme Grotto -destination 'name=iPhone 17 Pro' -derivedDataPath build/ios build
```

```bash
xcrun simctl install booted build/ios/Build/Products/Debug-iphonesimulator/Grotto.app
```

```bash
SIMCTL_CHILD_GROTTO_DEV_SERVER_ORIGIN="http://localhost:$(($(dev-port) + 3))" SIMCTL_CHILD_GROTTO_CLERK_PUBLISHABLE_KEY="$(grep VITE_CLERK_PUBLISHABLE_KEY apps/website/.env.development | cut -d= -f2)" xcrun simctl launch booted build.grotto.ios
```

`SIMCTL_CHILD_` prefixes pass an environment variable through to the launched
app. Grotto Server listens on the fourth port of the worktree's group, which is
`dev-port` plus three; the development Clerk publishable key is the checked-in
one the website already uses. A Debug build accepts a development origin only on
`localhost`, `127.0.0.1`, or `::1`, requests the localhost-only
`dev.createClerkSignInToken` ticket, activates it through Clerk's native SDK, and
calls `server.developmentBootstrap` before loading the Server list. It caches the
last validated configuration, so a later plain `xcrun simctl launch booted
build.grotto.ios` reuses the same development Server and Clerk instance without
the environment. Release builds carry no development path and always use the
production Server.

Launching without those variables on a fresh install leaves the app on
production sign-in, which needs a real Google account and cannot be automated.

## Claude Code Previews

`.claude/launch.json` tells Claude Code's browser preview which port to attach
to. It is gitignored, not committed, because the port is per-checkout. A
`SessionStart` hook in `.claude/settings.json` runs
`scripts/generate-claude-launch.mjs`, which writes the file from the same
`resolveDevPorts` group the dev stack uses — so the preview always points at the
website port that `bun run dev` actually binds. Nothing to do by
hand; the file regenerates each session.

## Activation Preview

In development builds, `/prototype/activation` renders every activation surface — sign-in, Server
choice and creation, invitations, Computer login, and Cove onboarding — as
independently addressable scenes for design iteration. Each scene mounts the
real component; a fixture tRPC client
(`apps/website/src/features/activation-preview/`) answers its Grotto API calls,
so no hosted Server, Computer, or signed-in session is needed. The URL selects
the scene (shareable per step) and a floating picker switches between them.
Production builds do not register this route or bundle its fixture Server.
Mutations resolve against fixtures: approving the Computer login code plays the
pending → approved → connected arc live; everything else fails with a clear
preview message after showing its pending state.

## Shutdown

From the terminal, stop the dev stack with `Ctrl+C` or `kill -TERM <dev-stack-pid>`.
The stack forwards that signal to every directly managed child process immediately, then waits
for each process group to exit before returning control to the shell.

In desktop mode, quitting the app with `Cmd+Q` also lets the stack unwind. The
desktop process exits first, then the stack signals the remaining website,
local backend, Server, Computer, and PostgreSQL processes.

## Verification

Use [Testing](testing.md) for test lanes and e2e rules.
