# Grotto

Grotto is a macOS chat app for working with always-on agents.

Grotto Runtime is the local chat server. It owns canonical chats, messages,
participants, sequence, events, reads, deliveries, activity, automations, and
runtime-owned product state. Grotto App is the first-party Electron client and
presentation layer. The internal agent engine runs turns through local AI SDK
language models and projects execution activity back into Grotto Runtime.

The repository, package namespace, API types, environment variables, and dev
state retain the internal `tavern` name. Production app and Runtime artifacts
use Grotto names and `~/.grotto` state paths.

## Architecture

```text
Grotto App
  -> @tavern/sdk
  -> Grotto API
  -> Grotto Runtime
  -> Agent engine
```

`packages/tavern-api` is the cross-boundary contract package. OpenAPI is the
wire source of truth, and the package also owns the shared Zod contracts used by
the current Runtime/App/admin surfaces.

`packages/tavern-sdk` is the TypeScript client over that API. Bots, webhooks,
automations, local tools, tests, and the app use the SDK/API
shape instead of a second protocol package.

## Repo Layout

* `packages/tavern-api`: OpenAPI and shared Grotto API contracts.
* `packages/tavern-sdk`: TypeScript client wrapper for Grotto API.
* `apps/runtime`: always-on Grotto Runtime and local agent engine.
* `apps/server`: local app backend, tRPC facade, app cache, and product logic.
* `apps/website`: Electron/React app client.
* `jobs`: local background jobs for sync, usage ingest, and refresh work.

## Development

Install dependencies:

```bash
bun install --frozen-lockfile
```

Run the full local stack:

```bash
bun run dev
```

`bun run dev` starts the local app backend, PostgreSQL, Grotto Server, Grotto
Computer, and the website dev server; `bun run dev-app` adds the desktop shell.

Dev state is isolated under the worktree-specific Grotto dev root.

Local dev ports are derived from the worktree path so multiple worktrees can run
at once. Override them with:

```bash
TAVERN_RUNTIME_HOST=127.0.0.1
TAVERN_RUNTIME_PORT=18790
TAVERN_AGENT_PROVIDER=openai
```

Set `TAVERN_RUNTIME_HOST=0.0.0.0` and point the app at
`http://<host>:18790` when Runtime runs on an always-on Mac.

Production Runtime installs expose `grotto` as the CLI and
`grotto-runtime` as the service binary. `grotto update` upgrades the
Homebrew formula and restarts the service by default.

## Desktop Build

Build a debug desktop app and DMG:

```bash
bun run desktop:build
```

The macOS outputs are written under `apps/website/electron-dist/`.

## Docs

Start with [docs/README.md](docs/README.md).
