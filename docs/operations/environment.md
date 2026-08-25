---
summary: How every Grotto environment value is declared, stored, resolved, and delivered — the .env.schema contract, its 1Password sources, and the four venues that read it.
read_when:
  - adding, renaming, rotating, or removing an environment variable
  - wiring a new consumer (script, workflow, cloud agent, service) to a credential
  - a value resolves empty, a deploy refuses to run, or `env:contract` fails
---

# Environment and secrets

Grotto has no `.env` step. The committed root [`.env.schema`](../../.env.schema)
is the contract — canonical names, types, sensitivity, and the exact 1Password
reference each lifecycle resolves — and [Varlock](https://varlock.dev) is the
only loader. Nothing else reads an environment file, in development or in
production.

## The three lifecycles

`VARLOCK_ENV` selects one, and it is a fail-loud enum: any other value,
including lifecycles Varlock can infer for itself in CI, is rejected at load
rather than quietly riding each value's development arm.

| Lifecycle | Resolves from | Used by |
| --- | --- | --- |
| `development` | `Development` vault | the dev stack, Cursor cloud agents, operator commands |
| `production` | `Production` vault | the Mac mini deploy job only |
| `test` | fake-but-shaped literals in the schema | every test lane and `env:check` — fully offline, no 1Password access |

Sensitivity fails safe: an item with no explicit `@sensitive` or `@public`
resolves as sensitive. `env:contract` rejects an item that states neither, and
rejects any `VITE_` item marked sensitive — those are inlined into the public
Grotto App bundle at build time.

## Where values live

1Password account `knickerbockerventures.1password.com`. Lifecycle vaults are
the access boundary.

| Item | Vault | Holds |
| --- | --- | --- |
| `Clerk - Grotto` | `Development`, `Production` | Grotto's own Clerk tenancy — backend key, publishable key, issuer |
| `Dev Sign-In User - Grotto` | `Development` | the Clerk user the local auto sign-in signs in as |
| `Google MCP OAuth - Grotto` | `Development` | OAuth client for the Google Calendar MCP connection |
| `Postgres - Grotto` | `Production` | runtime URL, migration URL, container admin password |
| `HugeIcons Pro - Merchbase` | `Development` | shared licensed registry key (adopted, not copied) |
| `HeroUI Pro CICD - Merchbase` | `Development` | shared licensed artifact token (adopted, not copied) |
| `Apple Notarization - Merchbase` | `Tooling` | shared notarization identity (adopted, not copied) |
| `S3 Release - Merchbase Desktop` | `Tooling` | shared release-bucket IAM key (adopted, not copied) |
| `Computer Release Signing - Grotto` | `Tooling` | Ed25519 keypair that signs Computer releases |

`Tooling` is readable by no service identity, so every release reference
resolves through the *development* instance: an operator running a release
under `varlock run` satisfies it with desktop authorization.

## Who is allowed to read

Humans and supervised local agents authorize through the 1Password desktop app.
Unattended consumers each hold their own read-only identity, and the schema
names exactly two bootstrap slots for them:

| Slot | Filled by | Reads |
| --- | --- | --- |
| `DEPLOY_AGENT_PRODUCTION_OP_TOKEN` | the `GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN` repository secret, on the mini's self-hosted runner | `Production` + `Development` |
| `CURSOR_CLOUD_AGENTS_DEVELOPMENT_OP_TOKEN` | a Cursor account-level Runtime Secret, fleet-wide | `Development` |

Both are `@internal`, so `varlock run` never passes them to a child process.
That repository secret is the only platform-held credential Grotto has, and
`env:contract` fails the build if a workflow grows another.

## Context switches

Machinery credentials resolve only behind an explicit switch, so the Vite
build, the dev stack, the Server, and the test lanes never contact 1Password —
and a cloud agent that can reach none of them still passes `check`.

- `GROTTO_RESOLVE_INSTALL_TOKENS` — the licensed registry credentials, set by
  `scripts/setup-worktree.mjs` and the Quality workflow.
- `GROTTO_RESOLVE_RELEASE_TOKENS` — Apple, S3, and Computer signing
  credentials, set by the `release:*`, `computer:release`, and `publish:desktop`
  scripts.

Release commands run `varlock run --include-internal`, because `varlock run`
strips `@internal` items by default and every release credential is one.

## Source → delivery → runtime

```
                    .env.schema  (the contract; committed)
                          │
        ┌─────────────────┼──────────────────┬───────────────────┐
        │                 │                  │                   │
   varlock run       varlock printenv   deploy job          test lifecycle
   (dev stack,       (install tokens,   (VARLOCK_ENV=          (literals,
    build, release)   under a switch)    production)            offline)
        │                 │                  │                   │
   process env        process env      config/server.env     process env
                                        (0600 + one ACL)
                                              │
                                    operations/run-server
                                              │
                                    launchd com.grotto.server
```

The hosted Server never invokes Varlock. `config/server.env` is the delivered
runtime copy, rendered fresh on every deploy by
`scripts/render-server-env.ts` from exactly the names the Server's typed env
module validates — the delivered set — then read back names-only by
`scripts/verify-deployed-secrets.ts` against that same set, which both derive
from `deliveredEnvironmentNames` in `scripts/lib/env-schema.ts`. A deploy-time
credential such as `GROTTO_DATABASE_MIGRATION_URL` is production-required in the
schema and deliberately outside the delivered set: the deploy job resolves it
for itself and the running Server never receives it. The contract comes from the deploy
workflow's own revision rather than the released artifact — see
[the deployment doc](grotto-server-deploy.md#where-the-contract-comes-from) for
why, and for the guard that keeps the two from drifting apart silently. A launchd job stores a command line, so
`run-server` invokes the Server binary directly — a job that re-entered Varlock
would resolve the schema again at boot, under the development lifecycle.

## Commands

| Command | Does |
| --- | --- |
| `bun run env:check` | validates the schema in the `test` lifecycle, fully offline |
| `bun run env:contract` | name-only drift check across schema, Server, release scripts, launchd, and workflows |
| `bun run env:load` | resolves the current lifecycle and prints it with secrets masked |
| `bun run dev` | the dev stack under `varlock run` |

## Rules

- Add a variable by adding it to `.env.schema` with an explicit sensitivity
  marker and an arm for every lifecycle — including a fake-but-shaped `test`
  arm, or the offline lanes break.
- A value the dev stack derives per worktree (ports, state roots) is a process
  contract between our own processes, not a schema item. It resolves to
  `undefined` in the schema's development arm, never `""`: the Server's zod
  schema treats an empty string as present and would reject it instead of
  applying its default.
- Never commit a `.env`. The deploy job refuses to run when one exists in the
  workspace or the deploy root: Varlock loads it above the schema, and a `$` in
  any of its values is parsed as an expression.
- Rotate at the provider, update the 1Password item, redeploy, verify, revoke.
  Stable names mean no repository change.
