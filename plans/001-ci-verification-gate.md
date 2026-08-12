# Plan 001: Gate every deploy on typecheck, lint, and unit tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0d1c19a2..HEAD -- .github/workflows/deploy.yml package.json apps/website/package.json`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `0d1c19a2`, 2026-06-10

## Why this matters

The only CI workflow, `.github/workflows/deploy.yml`, builds and deploys to the
always-on host on every push to `main` with **zero verification**: no
typecheck, no lint, no tests. A broken commit deploys automatically. There is
also no root `test` script — each workspace has its own test lane and nothing
runs them all — and `apps/website` has 80+ unit test files (`bun:test`) with
**no `test` script at all**, so they only run if someone remembers the raw
command. This plan creates a single "run everything" entry point and makes the
deploy depend on it. Every other plan in `plans/` uses these commands as its
verification gate, so this one lands first.

## Current state

- `.github/workflows/deploy.yml` — single `deploy` job on a **self-hosted
  runner** (a Mac mini). It does NOT build from the checkout; it `git pull`s a
  separate deployed checkout at `/Users/zknicker/srv/tavern` and runs
  `./scripts/deploy-local.sh` there:

  ```yaml
  jobs:
    deploy:
      name: Build and Deploy
      runs-on: self-hosted
      steps:
        - name: Checkout
          uses: actions/checkout@v4
        - name: Build and deploy
          working-directory: /Users/zknicker/srv/tavern
          run: |
            git pull --ff-only
            ./scripts/deploy-local.sh
  ```

- Root `package.json` — has `typecheck` and `lint` scripts but no `test`
  script. Package manager is `bun@1.3.5`.
- Per-workspace test lanes (from each `package.json`):
  - `apps/server`: `"test": "node scripts/run-tests.mjs"` — walks `test/` and
    `src/`, runs `bun test <file>` per file.
  - `apps/website`: **no `test` script** — but `src/**/*.test.ts(x)` files
    exist using `bun:test` (e.g. `apps/website/src/features/shell/sidebar-agent-list.test.ts`
    imports from `bun:test`).
  - `packages/tavern-api`, `packages/tavern-sdk`: `"test": "bun test"`.
  - `packages/claude-usage`, `packages/codex-usage`: `"test": "vitest run"`.
- `docs/operations/testing.md` — describes the verification lanes. Read it
  before step 2 and keep its lane descriptions accurate if you change anything.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install --frozen-lockfile`          | exit 0              |
| Typecheck | `bun run typecheck`                      | exit 0              |
| Lint      | `bun run lint`                           | exit 0              |
| Server tests  | `bun run --filter @tavern/server test`  | all pass        |

## Scope

**In scope** (the only files you should modify):
- `package.json` (root — add `test` script only)
- `apps/website/package.json` (add `test` script only)
- `.github/workflows/deploy.yml`
- `docs/operations/testing.md` (only if lane wiring changes what it documents)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `scripts/deploy-local.sh` and anything under `/Users/zknicker/srv/tavern` —
  the deploy mechanics are not this plan's business.
- Any test file content. If a test fails at baseline, that is a STOP
  condition, not something to fix here.
- Pre-commit hooks / husky — deliberately not part of this plan.

## Git workflow

- Branch: work on the current branch unless the operator says otherwise.
- Conventional Commits, e.g. `ci: gate deploys on typecheck, lint, and unit tests`.
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Establish the baseline

Run `bun install --frozen-lockfile`, then each command in the table above.
Record which pass. All four verification lanes are expected to pass at HEAD;
the advisor could not confirm this (worktree had no node_modules), so this
step is load-bearing.

**Verify**: all commands exit 0. If any fails → STOP condition.

### Step 2: Wire the website unit-test lane

Add to `apps/website/package.json` scripts: `"test": "bun test src"`.
Run it. These are `bun:test` files; some import React components. If more
than a handful fail for environmental reasons (missing DOM APIs, JSX
transform), do not chase them — remove the script again and record in
`plans/README.md` that the website unit lane needs its own setup, then
continue with step 3 **without** the website lane.

**Verify**: `bun run --filter @tavern/website test` → all pass (or lane
documented as deferred).

### Step 3: Add the root test script

Add to root `package.json` scripts, mirroring the existing `typecheck` chain
style (explicit filters, not `--filter '*'`, so ordering and inclusion are
deliberate):

```json
"test": "bun run --filter @tavern/api test && bun run --filter @tavern/sdk test && bun run --filter @tavern/claude-usage test && bun run --filter @tavern/codex-usage test && bun run --filter @tavern/server test && bun run --filter @tavern/website test"
```

(Drop the website entry if step 2 deferred it.)

**Verify**: `bun run test` → exit 0, every lane runs.

### Step 4: Add a verify job to the deploy workflow

In `.github/workflows/deploy.yml`, add a `verify` job before `deploy` and make
`deploy` depend on it:

```yaml
jobs:
  verify:
    name: Verify
    runs-on: self-hosted
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Install
        run: bun install --frozen-lockfile
      - name: Typecheck
        run: bun run typecheck
      - name: Lint
        run: bun run lint
      - name: Test
        run: bun run test

  deploy:
    needs: verify
    ...existing job unchanged...
```

The verify job runs in the runner's default workspace checkout — do NOT give
it `working-directory: /Users/zknicker/srv/tavern`. The runner is the same
Mac mini that deploys, so `bun` is available on it; you cannot execute the
workflow locally — validate the YAML instead.

**Verify**: `bun x yaml-lint .github/workflows/deploy.yml` exits 0 (or
`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml'))"`),
and `git diff .github/workflows/deploy.yml` shows the deploy job itself
unchanged apart from `needs: verify`.

## Test plan

This plan adds no product code, so no new tests. The verification is the
baseline run itself (step 1) plus the root script run (step 3).

## Done criteria

- [ ] `bun run test` exists at the root and exits 0
- [ ] `bun run typecheck` and `bun run lint` exit 0
- [ ] `.github/workflows/deploy.yml` has a `verify` job and `deploy` has `needs: verify`
- [ ] Deploy job steps otherwise byte-identical to before
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any baseline lane in step 1 fails — report exactly which suite and the
  failing output; the repo needs that fixed before a CI gate is honest.
- Website tests fail under `bun test src` for non-environmental reasons
  (assertion failures) — report them, don't fix them.
- The deploy workflow has changed shape since `0d1c19a2` (drift check).

## Maintenance notes

- New workspaces must be added to BOTH the root `typecheck` chain and the new
  root `test` chain — there is no glob, by design.
- If the self-hosted runner is ever replaced, the verify job assumes `bun` on
  PATH.
- Deliberately deferred: pre-commit hooks, e2e in CI (playwright on a deploy
  box is a separate decision), and any caching of `bun install`.
