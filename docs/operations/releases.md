---
summary: Grotto release targets, artifact publication, prerequisite ordering, and production promotion boundaries.
read_when:
  - cutting, publishing, or monitoring a Grotto release
  - deciding which Grotto release targets changed
  - changing release records, target jobs, or production promotion
---

# Releases

Use the [Grotto release skill](../../.agents/skills/release-grotto/SKILL.md) for the recurring
release procedure: target decisions, the release record, the release PR, workflow monitoring, and
the operator handoff. This document keeps the durable target and promotion contract.

## One release, five targets

Each release has one append-only `releases.json` record and one release PR. Merging that PR starts
one `Release` workflow. Every new entry contains all five target keys: a published target carries
its version, while an unchanged target is `null` and is skipped rather than rebuilt.
iOS publication carries both its version and build number.

| Target | Publish when |
| --- | --- |
| `server` | Hosted API, persistence, Server behavior, or the web Grotto App artifact changes |
| `app` | Electron shell, preload bridge, native desktop behavior, or installed desktop artifact changes |
| `ios` | Native iPhone code, metadata, entitlements, dependencies, or assets change |
| `computer` | Computer execution, lifecycle, human CLI, updater, embedded managed CLI, bootstrap/ordinary protocol, or a required Computer dependency changes |
| `agent` | Grotto-owned Agent instructions, actions, recipes, Harness behavior, or factory guidance changes |

Server and web App artifacts share the main Grotto product version. The desktop App, iOS, and
Computer targets retain their independent versioning rules. An iOS publication also records a new
positive build number. A target that is unchanged keeps its latest published version; do not copy
the release version into it.

Grotto Agent has independent SemVer but no standalone artifact. Its behavior package is embedded in
Server and Computer, so publishing Grotto Agent always publishes both targets. Server advertises
the current version; Computer records it only after an Agent successfully completes a turn with
that version. The App therefore distinguishes current, pending, and failed application.

The `Release` workflow builds, signs, publishes, and records evidence for selected artifact targets.
Grotto Agent publication is proven by the matching Server and Computer artifacts. When
Server publishes, the same graph waits at the protected `production` Environment, promotes the
exact artifact after approval, and verifies the public Server and hosted Grotto App.

## Target impact

Release preparation starts with `bun run release:collect-changelog-context`, before versions or the
new ledger entry are chosen. The helper resolves each target's latest recorded release source and
compares its owned shipping inputs with the candidate. It uses target tags when available and the
recorded release commit for legacy entries that predate reliable tagging. Direct target changes are
`required`; shared, generated, or dependency inputs are `review`; targets without owned changes are
`unchanged`.

Required impact is a floor, not a suggestion. `release:check` and the Release workflow reject a
ledger entry that marks a required target `null`. For every review file, the release agent traces the
changed export, dependency, or generated input to each named target and records `affects` or `does
not affect` with a reason. Files may share one disposition only when the same evidence applies. The
agent may widen the release for compatibility or an explicit operational reason. Because every
target uses its own published baseline, an incorrect earlier `null` cannot hide pending changes from
later release preparation.

The same target-scoped evidence feeds changelog writing. Programmatic scope determines what ships;
agent judgment assigns versions, groups commits into user-facing outcomes, and removes internal
churn and filler before the release PR.

## Prerequisites

When a Server change raises the required Computer protocol, the compatible Computer artifact must
be published and publicly verified before the Server is promoted. Use the
[Computer release and update spec](../../specs/raft-alignment/computer-release-and-update.md) for
the signed standalone artifact, descriptor, updater, rollback, and acceptance contract.

Use the [Computer login cutover](computer-login-cutover.md) for the expanded-Server → Computer →
final-Server sequence. Each distinct checkpoint follows the one-PR/one-workflow release procedure;
the sequence and rollback order are not replaced by ordinary target selection.

Use [iOS TestFlight](ios-testflight.md) for App Store Connect setup, build-number continuity,
processing, internal distribution, and real-device smoke. A processed TestFlight build is published
evidence; tester invitation and production App Store promotion are separate actions.

## Production Server promotion

The Server and web Grotto App are one atomic production artifact with one Server SemVer.
A push to `main` without a release record does not deploy. A selected Server release queues
production promotion behind the `production` Environment approval. The deployment workflow also
keeps its manual entry point: `deploy` downloads, verifies, installs, and activates a published
artifact; `activate` verifies and switches to an already installed release.

The selected `server` target publishes a deployable artifact, then calls the reusable `Deploy
Grotto Server` workflow with the exact version and source identity. The production Environment is
the explicit human promotion boundary; it requires reviewer approval and permits only `main`. The
Release workflow cannot finalize while approval or deployment is pending.

Read [Grotto Server deployment](grotto-server-deploy.md) for artifact verification, migrations,
activation, health checks, and rollback. A release is production-ready only after the protected
deployment succeeds and public health is healthy. Environment approval, a merged PR, or a green
artifact job alone is not deployment evidence.

The Server deployment path preserves the full source SHA and content digest as deployment identity.
It runs the candidate migration program before activation; application rollback does not reverse a
database migration. Urgent production changes use a new patch release.

## Release evidence

The record and handoff distinguish these states:

- planned target decision;
- published target artifact;
- protected Server deployment and database result;
- target-specific smoke and public health;
- failed, skipped, pending, and recovered work.

The release skill sends one operator-facing handoff after the selected target jobs and any required
Server promotion reach a terminal or explicitly pending state. It lists all five target
states, names only actionable updates, links the PR/workflow/deployment evidence, and reports gaps
instead of inferring success from changed files.

Release credentials and environment ownership remain in [Environment](environment.md). Do not put
secrets in `releases.json`, release metadata, workflow inputs, changelog text, or the handoff.
