# AGENTS.md

Always-on Tavern guidance for AI coding assistants.

## Start Here

- Work in this repository or worktree. Do not jump to sibling checkouts unless asked.
- Run `bun run docs:list` at task start. Read docs whose `Read when` hints match the work.
- Prefer the docs and source over memory. If docs and code disagree, inspect source and update the
  stale doc as part of the change.
- Keep changes small and reviewable. Preserve user and parallel-agent work.

## Architecture Map

Tavern has three first-party layers plus an internal agent engine. Tavern is the product.
Tavern Runtime manages the engine dependency — users install only Tavern and experience
the engine's abilities as the assistant's abilities, never its plumbing.

| Layer | Owns |
| --- | --- |
| Tavern Runtime | Canonical chats, messages, participants, events, reads, automations, deliveries, runtime activity, Memory reads, agent execution, and Tavern tools. |
| Tavern App | The Electron/React product surface, local presentation, app cache, app settings, optimistic UI, and tRPC client behavior. |
| Tavern API / SDK | Stable contracts for chats, realtime, admin/runtime control, automations, Memory, skills, stats, and external clients. |
| Agent engine | Agent execution: instructions, turns, tools, model calls, and projected activity. |

Use product nouns directly:

- A `chat` is the durable conversation container.
- A `session` is one agent's single ongoing global execution context spanning
  every chat it participates in (specs/sessions.md).
- A `turn` is one execution inside a session.
- Tavern chat history is canonical Tavern Runtime state.
- Agent execution traces are execution evidence, not the product timeline.
- Memory is Tavern's durable knowledge surface.

## Docs Routing

- `docs/README.md` is the human docs front door.
- `docs/features/` describes user-facing capabilities.
- `docs/api/` describes API and SDK contracts.
- `docs/internals/` describes architecture, ownership, app/runtime boundaries, frontend structure,
  and data model.
- `docs/operations/` describes development, testing, releases, and runtime operations.
- `specs/` holds deeper product contracts and normative design.

Do not maintain a hand-written doc index here. Add or update `summary` and `read_when` frontmatter
so `docs:list` routes future agents correctly.

## Coding Rules

1. Keep TypeScript strictness enabled.
2. Follow the repo-standard Ultracite and Biome config. Use `bun run lint`.
3. Build types and contracts first before implementation details.
4. Make illegal states unrepresentable with narrow unions and runtime validation.
5. Keep modules focused and composable. Split files when responsibilities diverge.
6. Keep files under `300` LoC, excluding generated files. When a file grows past roughly `200` LoC
   or starts mixing concerns, split before adding more surface area.
7. Keep main exports and the core flow near the top; keep local helpers near the bottom.
8. Avoid unnecessary barrel files. Use them only for clear package or domain entrypoints.
9. Prefer immutable patterns and explicit validation at boundaries.
10. Handle edge cases and external failures explicitly; do not swallow errors.
11. Keep comments, docs, and user-facing text short and in plain product language.
    User-facing copy must not name internal engine dependencies; frame engine abilities as the
    agent's or assistant's abilities ("agent engine" for technical surfaces). Internal identifiers,
    env vars, API fields, and file names should use Tavern or agent-engine naming.
12. Use concise product names. Avoid vague names such as `provider`, `manager`, `helper`, or `data`
    when a domain term exists.
13. Use kebab-case file names.
14. Add or update focused tests when behavior changes. Use
    [Testing](docs/operations/testing.md#lane-selection) to choose the smallest
    verification lane that proves the change.

## API And Events

- Server tRPC features live in `apps/server/src/api/<feature>/`.
- Each feature exposes a `router.ts` plus one file per procedure when the feature has multiple
  procedures.
- Keep API procedures thin: validate input, call product logic, and return a narrow result.
- Put business logic under product nouns. Keep external-system code behind adapters.
- Define server-to-client invalidation events in `apps/server/src/api/invalidation-events.ts`.
- Prefer named domain subscriptions such as `chat.onTurnStarted` or `agent.onUpdate` over generic
  event buckets.
- App event hooks should own their tRPC subscription and the exact React Query invalidation or cache
  update.

## Tavern App UI

- For React route, hook, query, realtime, optimistic UI, or state architecture work, use the
  `react-best-practices` skill and read `docs/internals/react.md`.
- The app is sync-first. Render the best synced data we have even when Runtime is offline or
  reconnecting.
- Runtime connection state belongs in a focused hook or small UI surface such as a badge. Avoid
  full-page runtime loading gates except for real setup/onboarding boundaries.
- Keep persistent synced data separate from volatile runtime state. Do not attach high-churn fields
  to shared records when a focused query can expose that activity.
- Keep optimistic chat rows app-local. Do not patch durable chat history to show optimistic rows.
- Keep hooks granular and capability-first under `apps/website/src/hooks/<capability>`.
- Runtime and agent-engine feature gates must use Runtime capabilities as the singular
  readiness contract. Do not gate app behavior on app-local connection `lastError`, sync
  timestamps, process guesses, or cached engine state. Add a Runtime capability when the
  requirement is not represented. Prefer primitive capability gates such as `gateway` over
  umbrella feature names.
- The UI system is HeroUI v3 (`@heroui/react` + `@heroui-pro/react`). Do not add new Base UI,
  COSS, shadcn, or Radix usage; the legacy `components/ui` kit is being retired and must not gain
  new call sites. See `docs/internals/heroui-migration.md` for scope and status.
- Use HeroUI components stock. Customize through component props (`variant`, `size`, semantic
  states) — never by styling their `className` at call sites. App-wide visual changes belong in
  the design-system CSS layer (theme variables and BEM class overrides), so styling lives in one
  place instead of littered across React components.
- Use the HeroUI design tokens (`bg-surface`, `text-muted`, `text-accent`, etc.) for UI colors. Do
  not hand-roll component-local color mixes or arbitrary color values unless a new reusable token
  is first added to the theme layer.
- Follow `DESIGN.md` for visual design decisions, especially token usage, settings layout, and
  shared component behavior. Consult the `heroui-react-pro` and `heroui-pro-design-taste` skills
  plus the HeroUI Pro MCP (`list_components` → `get_component_docs`) before building UI.
- For motion polish, use Fluid Functionalism's motion guidance and ThinkingIndicator reference:
  https://www.fluidfunctionalism.com/docs/motion and
  https://www.fluidfunctionalism.com/docs/thinking-indicator.

## Runtime And Data

- Runtime owns canonical chat records, durable events, activity state, Memory reads, agent
  execution, and runtime tools.
- App storage is cache, settings, local presentation state, and runtime evidence views.
- Runtime adapters project Tavern primitives plus source facts. They must not author final Tavern
  presentation such as display names or fake chat workspace folders.
- Preserve participant source labels as observed labels. Do not merge participants by display name
  or reintroduce observed-identity linking without a current product spec.
- Message sends to agents must resolve a Runtime-owned agent presence for the selected
  frontend conversation and agent, then use that presence's current session binding.
  Do not let apps or external frontends invent routing ids from Discord channels, DMs,
  Tavern chat ids, or opaque engine session ids.
- If a runtime record is missing a required stable id, timestamp, schedule, file content, or actor,
  fail the mapping or mark the capability degraded instead of inventing a value.
- Treat `apps/server/src/db/bootstrap.ts` as fresh-schema setup only. For local SQLite migrations,
  directly edit the local database after operator approval instead of adding migration code.

## Testing And Smoke

- Prefer unit/service tests or the deterministic app e2e mock runtime over manual smoke
  chats in a real local runtime.
- Runtime tests should use real temp SQLite databases and temp directories when testing storage,
  idempotency, ordering, recovery, or projection behavior.
- Mock only true external boundaries: model calls, process/container execution, network transports,
  time, and randomness.
- Do not write tests whose main assertion is that a spy was called.
- If manual validation must create real Tavern chats, use a temporary first message such as
  `Codex smoke <timestamp>: <purpose>`, record the chat ids, and delete only those chats.
- If cleanup fails, report the exact chat ids or titles left behind. Do not delete pre-existing
  chats or broad groups of rows unless explicitly asked.

## Change Scope And Maintenance

- Prefer the simplest end-to-end change that resolves the requirement.
- Promote code to a top-level domain area when it already represents a product or platform concept;
  do not wait for a second call site when ownership is clear.
- Do not add extension points, abstractions, compatibility branches, or schema-normalization paths
  unless they are needed now.
- For cross-boundary runtime, admin, or product contract changes, update `packages/tavern-api`
  directly for the current first-party contract.
- Keep docs current when API shape, storage models, frontend structure, or runtime assumptions
  change.
- Keep startup status logging intact in the server entrypoint when adding features.
- Keep secrets out of version control.
- Update `.env.example` when environment variables change.
- If requirements are unclear, update the relevant spec and ask.

## Agent Engine Work

- Tavern Runtime owns model config, capability checks, instruction composition, tool exposure,
  and the Tavern chat-to-agent turn runner. The engine dependency is internal and not a
  user-facing product surface; see Coding Rule 11 for the product-language boundary.
- The current implementation lives under `apps/runtime/src/agent-engine/`. That module may use
  AI SDK, ACP, or other implementation dependencies internally, but public ids, env vars, docs,
  app copy, API metadata, and inspectable runtime records must use Tavern or agent-engine naming.
- Runtime executes turns with local AI SDK `LanguageModel` instances. It does not run Vercel
  Gateway infrastructure or a managed external engine process.
- For agent-engine changes, run the normal runtime dev stack or
  `bun run --filter @tavern/runtime build` to verify Runtime startup and adapter code.

## Agent System Prompt Changes

The composed agent system prompt is a guarded contract. Its sources are
`apps/runtime/src/workspace/managed-instructions.ts`,
`apps/runtime/src/tavern/agent-instructions.ts`,
`apps/runtime/src/tavern/model-instructions.ts`, and
`apps/runtime/src/agent-engine/instructions.ts`; its executable requirements,
reviewable snapshots, and character budgets live in
`apps/runtime/src/tavern/agent-prompt-contract.test.ts`.

When changing prompt text or that contract test:

1. Run the contract suite and read the snapshot diff; include the diff in what
   you show the operator.
2. Never delete or weaken a requirement, raise a budget, or rewrite a snapshot
   just to make the suite pass. A failing requirement means a capability left
   the prompt — stop and get explicit operator confirmation that the removal
   is intentional.
3. Adding a prompt-taught capability requires adding its requirement in the
   same change; removing one requires removing its requirement, named
   explicitly in your summary to the operator.
4. Budget raises are deliberate token-spend decisions. Propose the new number
   and why; do not silently bump.
5. After meaningful prompt-text changes, run the behavioral evals against a
   running dev stack: `bun run eval:prompt` (real model turns; see
   [Testing](docs/operations/testing.md#prompt-behavior-evals)).

## Agent skills

### Issue tracker

Issues live in the Linear `PRD` team with the `Tavern` label. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary in Linear. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: use root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
