---
summary: Testing strategy for choosing focused lanes, writing durable tests, keeping suites current, and avoiding unnecessary route or smoke coverage.
read_when:
  - adding tests, changing runtime contracts, or choosing a verification lane
  - changing OpenAPI, Runtime stores, SDK, app e2e, or managed runtime contract behavior
---

# Testing

Use the smallest test lane that can fail for the bug or behavior you changed.
Prefer tests at the owner of the rule: domain logic, store, service, hook, or
e2e flow.

## Development Cycle

The full suite is huge. Never run it as a default gate — scope every run to
what the change can actually break.

While iterating, run the single test file:

```sh
# runtime (vitest; add -t for one case)
bun run --filter @tavern/runtime test src/tavern/agent-session-store.test.ts

# server and website (bun test; run from the package directory)
cd apps/server && bun test test/agent-runtime-client.test.ts
cd apps/website && bun test src/features/shell/sidebar-chat-list.test.ts
```

Before handoff, gate with the touched packages only:

```sh
bun run lint
bun run --filter @tavern/<touched-package> typecheck
bun run --filter @tavern/<touched-package> test
```

Pick lanes by touched path:

| Touched path | Gate |
| --- | --- |
| `apps/runtime` | `@tavern/runtime test` + `typecheck`. The runtime build bundles without tsc, so nothing else typechecks runtime code. |
| `apps/server` | `@tavern/server test` + `typecheck`. Hosted Server tests provision a throwaway cluster from locally installed PostgreSQL binaries; install PostgreSQL 16 or point `GROTTO_POSTGRES_BIN` at its bin directory. |
| `apps/website` | `@tavern/website test` + `typecheck` |
| `packages/tavern-api` | `@tavern/api check`, plus typecheck of the consuming apps you touched |
| `packages/tavern-sdk` | `@tavern/sdk test` |
| Browser-level contracts (navigation, reload, websocket, chat flows, layout) | `bun run test:e2e`, scoped to the affected spec file when possible |
| Harness executor, harness adapters, provider auth wiring, `@ai-sdk/harness-*` bumps | `bun run --filter @tavern/runtime test:smoke` (opt-in, real provider calls) |

Rules that keep runs cheap and honest:

* Lint is always part of the handoff gate. Use `bun run lint` / `bun run lint:fix`
  only — raw `bunx biome check` applies the wrong ruleset.
* Run runtime tests through the package script (they require Bun; node-run
  vitest fails on `bun:sqlite`).
* If a suite fails in code you did not touch, verify against an untouched
  checkout before chasing it — worktrees have carried baseline failures that
  are not your regression. Do not rerun whole suites to investigate.
* Full-package runs are for handoff gates; full-repo runs are for release
  prep, not development.

Before handoff, report the commands you ran and anything you did not verify.

## Test Lanes

| Lane | Use when | Keep current by |
| --- | --- | --- |
| Focused unit/domain tests | Pure logic, view models, hooks, mappers, scheduling rules, validation, or regressions. | Add one targeted regression for behavior changes. Avoid asserting implementation calls. |
| Runtime store/service tests | Persistence, ids, ordering, idempotency, transactions, recovery, chat, inbox cursors, jobs, or execution evidence. | Use real temp SQLite/temp dirs and the real store/service. Do not mock tables or transaction behavior. |
| Runtime handler tests | Boot, process wiring, HTTP payload shape, event delivery, or route-owned error/auth/transport behavior. | Use the real Bun handler or a started local service only when the handler owns meaningful behavior. |
| Hosted Server tests | Grotto Server identity, Chats, messages, reads, search, ordering, authorization, or realtime. | Drive the public tRPC surface through `test/grotto-server-harness.ts`: a throwaway PostgreSQL cluster plus a local Clerk issuer. Never mock PostgreSQL or the transaction. |
| Contract/API/SDK gates | `packages/tavern-api`, OpenAPI, SDK client shape, generated types, or cross-boundary request/response contracts. | Run `@tavern/api check`, SDK tests/typecheck, and update docs with the product contract. |
| App component/hook tests | React state rules, cache invalidation, optimistic UI, row models, filters, keyboard behavior, or rendering transforms. | Prefer hook/model/component tests before e2e. Use the `architect-react-features` skill for nontrivial React architecture. |
| App e2e | Browser-level app contracts: navigation, reload recovery, websocket reconnect, full chat identity, user flows, or layout-critical behavior. | Use deterministic Playwright against isolated ports, isolated DBs/runtime dirs, managed Runtime, and a fake executor. |
| Runtime executor tests | AI SDK executor mapping, event projection, delivery semantics, local sandbox behavior, or capability degradation. | Verify with Runtime fixtures, deterministic fake executors, or opt-in harness smoke tests. |
| Live/manual smoke | Real provider behavior, local environment diagnosis, or release confidence that deterministic lanes cannot cover. | Keep opt-in. Record temporary chat ids/titles and clean up only those records. |

## Lane Selection

Choose the smallest lane that proves the changed behavior.

* **Domain behavior or invariant:** test the owner: domain, store, service, hook,
  or view model.
* **Contract shape:** run the owning contract/typecheck gate. Add tests only
  when the contract carries validation, compatibility, or generated-client risk.
* **Thin route or tRPC procedure:** do not add route tests just because a route
  exists. Test the called domain behavior unless the route owns auth, coercion,
  error mapping, streaming, or transport semantics.
* **Frontend state or rendering rule:** prefer hook/model/component tests. Use
  e2e for browser-level contracts and real user flows.
* **Executor semantics:** use Runtime fixtures, deterministic fake executors, or
  opt-in harness smoke tests for the exact behavior Tavern depends on.

## Writing Tests

* Prefer Vitest for package-local tests unless the package already uses Bun
  tests.
* Prefer real temp SQLite databases, temp directories, and schema validation
  over module mocks.
* Mock only true external boundaries: model calls, process/container execution,
  network transports, time, and randomness.
* Assert user-visible or contract-visible outcomes: persisted rows, emitted
  events, returned JSON, cache state, rendered rows, or task transitions.
* Do not write tests whose main assertion is that a spy was called.
* Keep fixtures small and source-shaped. Use raw adapter frames or captured
  provider payloads when the product depends on exact external shape.
* For production bugs, add a focused regression at the boundary where the bug
  should have been impossible.

## App E2E

Use Playwright against the real App and hosted Server for browser-level
contracts. The lane uses isolated ports, PostgreSQL, attachments, and Clerk
fixtures. It must not point at developer model-provider credentials or start a
real Computer.

Chat E2E should prove identity and recovery, not styling details:

* accepted user message appears once
* reload and websocket reconnect recover without duplicates, missing rows, or
  ordering bugs
* completed messages and Threads remain available as durable history
* Agent-authored effects use the public runner contract rather than a real model

The e2e wrapper runs preflight before Playwright starts service readiness
timers. Preflight verifies Playwright Chromium and builds the SDK with visible
terminal progress.

Browser E2E uses the hosted product boundary by default:

```bash
bun run test:e2e
```

Run one spec while repairing a focused surface:

```bash
bun e2e/run-playwright.ts e2e/tests/hosted-messaging.spec.ts
```

The lane starts only the hosted Server, throwaway PostgreSQL, Clerk issuer, and
website. Computer inventory and Agent-authored effects use deterministic
fixtures or public runner contracts; no model runs. The membership spec still
drives the real invitation round trip across two Clerk identities. Actual
App-to-Computer-to-model behavior belongs to the live Agent E2E lane below.

## Runtime Adapter Contracts

When changing executor routes, event projection, chat behavior, or delivery
semantics, verify against deterministic service fixtures, hosted Browser E2E,
or an opt-in live harness smoke when a concrete ambiguity remains.

Add raw-frame or fixture-backed tests for behavior Tavern depends on.

## Manual Smoke Hygiene

Manual real-runtime chats are rare. Prefer deterministic e2e or unit/service
tests.

If manual validation creates real Tavern chats, use an obvious temporary first
message such as `Codex smoke <timestamp>: <purpose>`, record the created chat
ids, and delete only those chats before finishing. If cleanup fails, report the
exact chat ids or titles left behind.

Live Agent E2E teardown uses the localhost-only `dev.cleanupEvalChats`
procedure to delete exact test-created Chat ids. This is an authenticated,
non-production test seam, not a product Chat archive or deletion contract.

## Live Provider Smoke

Live provider tests are opt-in. They are not part of normal CI or default local
test lanes because they spend provider credits and depend on local tools,
network, and account state. Run the lane when a change touches the harness
executor, a harness adapter, provider auth wiring, or bumps an
`@ai-sdk/harness-*` dependency — deterministic lanes mock exactly the layer
this one exercises.

Run the automated smoke lane from `apps/runtime`:

```sh
bun run --filter @tavern/runtime test:smoke
```

The lane (`src/tavern/harness-agent-executor.smoke.ts`) executes one real agent
turn per provider through the harness executor against a temp database: OpenAI
via the Pi harness, Claude Code, and Codex. Each provider case skips itself
when its CLI or credentials are missing (OpenAI needs `OPENAI_API_KEY` or
`TAVERN_AGENT_API_KEY`; Claude needs the `claude` CLI; Codex needs the `codex`
CLI plus `~/.codex/auth.json`). An available provider that errors is a real
failure. Read the run summary — a skip-heavy pass proves less than it looks.
Other automated tests should fake the executor boundary instead of spending
provider credits.

## Prompt Behavior Evals

The composed agent system prompt has two guard layers. Text loss is caught in
CI by the prompt contract suite
(`apps/runtime/src/tavern/agent-prompt-contract.test.ts`): a requirements
ledger, reviewable full-prompt snapshots, and character budgets. Behavior loss
is caught on demand by `bun run eval:prompt`. The live lane signs in as the
configured development Clerk user and drives real hosted
Server-to-Computer-to-model turns through the public tRPC contract. It checks
mention handoff, explicit silence in channels and DMs, multi-chat draining,
and instruction-injection resistance.

The lane uses the seeded `#all` and `#product` channels plus each Agent's
ordinary Owner DM. It does not call the retired Runtime API or create
undeletable temporary chats. Run it after prompt-text edits and before
releases. Use `--only <substring>` to rerun one scenario, `--server <url>` to
target another hosted dev endpoint, or `--server-id <id>` to select a Server.
See AGENTS.md ("Agent System Prompt Changes").

## Session Behavior Evals

`bun run eval:sessions` uses the same hosted lane and checks the public
agent-global session contract end-to-end (`specs/sessions.md`): cross-chat
continuity, full serialization with auto-drain, mid-turn freshness, accepting
the next delivery after a session reset, and exact model-switch application.
It restores changed Agent configuration afterward. Internal generation and
resume bookkeeping remain covered by deterministic Computer tests; this live
lane asserts only behavior exposed by the hosted product contract.

Both evals require `bun run dev`, configured development Clerk keys, two
applied online Agents, and the seeded channels. Authentication uses a
localhost development sign-in ticket and Clerk's headless session refresh; it
does not use an auth bypass. Both scripts share `scripts/eval-harness.mjs`.

## Design Battery

`bun run eval:design` is a dev tool, not a suite: it drives the fixed
battery of visual prompts (`scripts/design-battery/battery.mjs`) through a
running dev stack as real model turns, screenshots each rendered result in
dark and light themes with Playwright, and writes per-run output plus a
`contact-sheet.html` under `scripts/design-battery/output/` (gitignored).
The verdict is human: judge the sheet against
`scripts/design-battery/RUBRIC.md`, revise the visuals skill sources
(`apps/runtime/src/agent-engine/visuals-skill/`), restart the stack to
reseed, and rerun. `--model <provider>/<model>` runs the battery on a
specific executor model (restored afterward unless `--keep-model`);
`--only <slug>` reruns a subset; `--reuse-chats` recycles the battery chat.
The battery chat is intentionally left unarchived for transcript
inspection. Rerun the loop after skill-text, token, or executor-model
changes (PRD-86, ADR 0012).

## Keeping Suites Current

* Add tests with the feature or bug fix, not in a later cleanup.
* Delete or rewrite tests when the product contract changes; do not preserve
  stale assertions to keep old behavior alive.
* Update docs when a new lane, mock provider behavior, fixture source, or
  verification command becomes the preferred path.
* Keep e2e focused on durable product contracts. Move logic regressions down to
  unit, hook, store, or service tests when possible.
* If a lane becomes flaky, either fix the product/test boundary or move the
  unstable part into an explicit live/manual lane.
