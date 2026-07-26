---
summary: Local development workflow for dev stack startup, Runtime state, and verification pointers.
read_when:
  - running Tavern locally or changing managed runtime development workflow
  - changing local stack startup, ports, or developer verification
---

# Development

## Local Stack

Run the full managed development stack:

```bash
bun run dev
```

This starts Tavern Runtime, the local app backend, and the website dev server.

The Server also needs PostgreSQL for hosted Grotto server state
([Grotto Server](../internals/grotto-server.md)). Once per machine:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb grotto
```

`GROTTO_DATABASE_URL` defaults to `postgres://127.0.0.1:5432/grotto`; set it in
the root `.env` to point elsewhere. Bootstrap a fresh schema explicitly before
starting the hosted Server:

```bash
GROTTO_DATABASE_BOOTSTRAP_URL=postgres://127.0.0.1:5432/grotto \
GROTTO_DATABASE_RUNTIME_ROLE="$(whoami)" \
bun run --filter @tavern/server bootstrap:grotto
```

Runtime startup checks PostgreSQL but never runs DDL. The bootstrap is for an
empty database only; there is no migration or adoption path.

The hosted Server is its own process, separate from the local sidecar:

```bash
bun run --filter @tavern/server dev:grotto
```

Point the App at it with `VITE_GROTTO_SERVER_ORIGIN` (default port `8090`) so
the `/s` routes reach it. `bun run dev` starts the local sidecar only.

The dev stack uses worktree-isolated development state by default:

```txt
~/.tavern/dev/<worktree-id>/tavern.sqlite
~/.tavern/dev/<worktree-id>/runtime
```

The stack derives a stable port group from the worktree path. Website, server,
and Tavern Runtime each get one port from that group, so multiple Tavern
worktrees can run at the same time without sharing Runtime state. This keeps the
managed dev Runtime out of the packaged app's `~/.grotto/grotto.sqlite` state.

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

That example uses ports `43000` through `43003`. Set `DATABASE_PATH` or
`TAVERN_RUNTIME_ROOT` explicitly when a dev run should use a specific app
database or Runtime root.

`.claude/launch.json` is gitignored and generated per checkout by a
`SessionStart` hook (`dev-port --claude-launch`), so Claude Code previews use
this checkout's real website port. The `dev-port` helper and the dev stack
derive the same four-port group from the checkout path, or from
`TAVERN_DEV_STACK_ID` when it is set.

Use `TAVERN_AGENT_PROVIDER`, `TAVERN_AGENT_MODEL`, and provider-specific
`TAVERN_AGENT_*` model variables when a dev run should use a specific local
model provider.

The Runtime API requires a bearer token. The dev stack reads (or creates) the
token from `<runtime root>/grotto.json` — the same config file the Runtime and
the `tavern` CLI resolve — and hands it to every stack process, so the token
is stable per worktree across sessions. To use the CLI against a running dev
stack, point it at the same state:

```bash
TAVERN_RUNTIME_ROOT=~/.tavern/dev/<worktree-id>/runtime \
TAVERN_RUNTIME_PORT=<runtime port> bun apps/runtime/src/index.ts status
```

`TAVERN_RUNTIME_TOKEN` overrides the file for CI or reproducible setups.

## Dev Toolkit

The development stack (`TAVERN_DEV_STACK=1`, set by `bun run dev*`) enables the
dev toolkit: Runtime helpers for exercising live chat surfaces without a model.
The `devToolkit` Runtime capability gates every surface.

- The shell toolbar shows a wrench menu on chat routes with **Simulate agent
  turn** (streamed preamble, tool activity, and reply text over ~15s) and
  **Simulate failed turn**. Simulated turns write through the normal chat API,
  so the status row, turn drawer, transcript streaming, and turn recovery
  behave exactly as they do for real model turns.
- Programmatic access: `POST /dev/simulate-turn` on the Runtime
  (`client.dev.simulateTurn` in `@tavern/sdk`, `dev.simulateTurn` in the app's
  tRPC API). The route 404s outside the dev stack.
- The simulator lives in `apps/runtime/src/tavern/development-turn-simulator.ts`;
  add scenarios there.

## Claude Code Previews

`.claude/launch.json` tells Claude Code's browser preview which port to attach
to. It is gitignored, not committed, because the port is per-checkout. A
`SessionStart` hook in `.claude/settings.json` runs
`scripts/generate-claude-launch.mjs`, which writes the file from the same
`resolveDevPorts` group the dev stack uses — so the preview always points at the
website port that `bun run dev:web:runtime` actually binds. Nothing to do by
hand; the file regenerates each session.

## Shutdown

From the terminal, stop the dev stack with `Ctrl+C` or `kill -TERM <dev-stack-pid>`.
The stack forwards that signal to every directly managed child process immediately, then waits
for each process group to exit before returning control to the shell.

In desktop mode, quitting the app with `Cmd+Q` also lets the stack unwind. The
desktop process exits first, then the stack signals the remaining website, app
backend, and Runtime processes.

## Verification

Use [Testing](testing.md) for test lanes and e2e rules.
