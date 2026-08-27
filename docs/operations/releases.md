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

## One release, four targets

Each release has one append-only `releases.json` record and one release PR. Merging that PR starts
one `Release` workflow with a job per target. The record explicitly marks every target `publish` or
`unchanged`; an unchanged target is skipped, not silently rebuilt.

| Target | Publish when |
| --- | --- |
| `server` | Hosted API, persistence, Server behavior, or the web Grotto App artifact changes |
| `app` | Electron shell, preload bridge, native desktop behavior, or installed desktop artifact changes |
| `ios` | Native iPhone code, metadata, entitlements, dependencies, or assets change |
| `computer` | Computer execution, lifecycle, human CLI, updater, embedded managed CLI, bootstrap/ordinary protocol, or a required Computer dependency changes |

Server and web App artifacts share the main Grotto product version. The desktop App, iOS, and
Computer targets retain their independent versioning rules. An iOS publication also records a new
positive build number. A target that is unchanged keeps its latest published version; do not copy
the release version into it.

The `Release` workflow builds, signs, publishes, and records evidence for selected targets. It runs
from the merged release commit. It does not make production Server state healthy: artifact
publication and Server promotion are separate states.

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

The selected `server` target publishes a deployable artifact through the `Release` workflow. That
workflow does not deploy the hosted Server. Production promotion is a separate manual
`Deploy Grotto Server` action for the exact published version and source identity.

Read [Grotto Server deployment](grotto-server-deploy.md) for artifact verification, migrations,
activation, health checks, and rollback. A release is production-ready only after the manual
deployment succeeds and public health is healthy. A deployment dispatch, a merged PR, or a green
artifact job alone is not deployment evidence.

The Server deployment path preserves the full source SHA and content digest as deployment identity.
It runs the candidate migration program before activation; application rollback does not reverse a
database migration. Urgent production changes use a new patch release.

## Release evidence

The record and handoff distinguish these states:

- planned target decision;
- published target artifact;
- manual Server deployment and database result;
- target-specific smoke and public health;
- failed, skipped, pending, and recovered work.

The release skill sends one operator-facing handoff after the selected target jobs and any required
manual Server promotion reach a terminal or explicitly pending state. It lists all four target
states, names only actionable updates, links the PR/workflow/deployment evidence, and reports gaps
instead of inferring success from changed files.

Release credentials and environment ownership remain in [Environment](environment.md). Do not put
secrets in `releases.json`, release metadata, workflow inputs, changelog text, or the handoff.
