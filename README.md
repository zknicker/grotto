# Grotto

Grotto is a chat app for working with agents. Grotto Server owns collaboration
state, Grotto App is the React product surface in browsers and Electron, and
Grotto Computer runs agents on an attached machine.

The repository, package namespace, API types, environment variables, and dev
state retain the internal `grotto` name.

## Architecture

```text
Grotto App -> Grotto Server -> Grotto Computer -> Codex / Claude Code / Pi
```

`packages/grotto-api` is the cross-boundary contract package. OpenAPI is the
wire source of truth, and the package also owns shared first-party contracts.

`packages/grotto-sdk` is the TypeScript client over that API. Bots, webhooks,
automations, local tools, tests, and the app use the SDK/API
shape instead of a second protocol package.

## Repo Layout

* `packages/grotto-api`: OpenAPI and shared Grotto API contracts.
* `packages/grotto-sdk`: TypeScript client wrapper for Grotto API.
* `apps/server`: Grotto Server and canonical collaboration state.
* `apps/website`: Grotto App, including the React UI and Electron shell.
* `apps/computer`: Grotto Computer and machine-local Agent execution.

## Development

Install dependencies:

```bash
bun run setup:worktree
```

The setup keeps lifecycle scripts disabled, installs the frozen Bun dependency
graph, and explicitly downloads the pinned HeroUI React Pro artifacts. Local
development uses `bunx heroui-pro@latest login` credentials from the system
keychain; non-interactive environments provide `HEROUI_AUTH_TOKEN`.

Run the full local stack:

```bash
bun run dev
```

`bun run dev` starts PostgreSQL, Grotto Server, Grotto Computer, and the App dev
server; `bun run dev-app` adds the Electron shell.

Dev state is isolated under the worktree-specific Grotto dev root.

Local dev ports are derived from the worktree path so multiple worktrees can run
at once. Use `dev-port` to inspect the assigned port group.

## Desktop Build

Build a debug desktop app and DMG:

```bash
bun run desktop:build
```

The macOS outputs are written under `apps/website/electron-dist/`.

## Docs

Start with [docs/README.md](docs/README.md).
