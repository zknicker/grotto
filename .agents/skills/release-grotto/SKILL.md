---
name: release-grotto
description: Prepare, merge, monitor, and hand off a Grotto release across the Server, App, iOS, and Computer targets. Use for release target decisions, append-only `releases.json` records, the single release PR, the post-merge `Release` workflow, production Server promotion, or release evidence.
---

# Grotto release

Use this skill for the release procedure. Durable artifact, protocol, installation, update, and
deployment contracts remain in the routed docs and specs below; do not recreate them here.

## Operating contract

- One release has one append-only `releases.json` record, one release PR, and one `Release`
  workflow run after that PR merges.
- The record uses exact `targets` keys: `server`, `app`, `ios`, and `computer`. A published target
  carries its version; an unchanged target is `null`; iOS publication carries `{ version,
  buildNumber }`.
- The `Release` workflow owns per-target build, signing, publication, and evidence jobs. It runs
  selected target jobs and reports every unselected target as unchanged.
- Release publication makes artifacts available. Production Grotto Server promotion is a separate
  manual `Deploy Grotto Server` action. Do not call a release production-ready until that action
  and public health checks succeed.
- Never put credentials, tokens, or private key material in the record, PR, changelog, or handoff.

The skill owns decision prompts, record preparation, PR/merge flow, monitoring, and handoff. Read
the target contract before choosing a target or promising a verification result.

## Route the contract

Start with [release targets and promotion](../../../docs/operations/releases.md). Read the linked
contract when the target is selected:

- Server: [Grotto Server deployment](../../../docs/operations/grotto-server-deploy.md)
- Computer: [Computer release and update spec](../../../specs/raft-alignment/computer-release-and-update.md)
- iOS: [iOS TestFlight](../../../docs/operations/ios-testflight.md)
- Login, setup, attachment, or protocol cutover: [Computer login cutover](../../../docs/operations/computer-login-cutover.md)

Use the repository's [testing change routing](../../../docs/operations/testing.md#change-routing) for
local proof. Use Bun and the commands already defined by the repository; do not invent a second
release command path.

## 1. Decide the targets

Inspect the complete change set against the release base, including generated files and shared
contracts. Record a target as `publish` when its shipped behavior or artifact changes:

| Target | Select `publish` for |
| --- | --- |
| `server` | Hosted API, persistence, Server behavior, or the web App artifact served by Server |
| `app` | Electron shell, preload bridge, native desktop behavior, or installed desktop artifact |
| `ios` | Native iPhone code, metadata, entitlements, dependencies, or assets |
| `computer` | Computer execution, lifecycle, human CLI, updater, embedded managed CLI, bootstrap/ordinary protocol, or required Computer dependency |

Ask these questions before writing the record:

1. Which target owns the changed behavior, and which shared dependency consumers ship with it?
2. Does the Server require a higher Computer protocol floor? If yes, the compatible Computer
   target must publish and verify before Server promotion.
3. Does iOS publish? Choose a new positive build number; never reuse a number that reached Apple.
4. Is a target truly unchanged? Record `unchanged` and resolve its current published version from
   the release evidence rather than copying another target's version.
5. Does the change use the login cutover sequence? Plan expanded Server, Computer, and final Server
   checkpoints and their rollback order from the cutover contract.

Do not widen a target merely because a release is coordinated. Every target decision needs a short
reason tied to the diff or to a prerequisite.

## 2. Prepare the append-only record

Before editing, read the existing `releases.json` and ledger validator. Preserve every prior record and
append exactly one planned release record at the end. Never sort, compact, rewrite, delete, or amend
an earlier release entry. If the file or validator is missing, stop and route the contract gap; do not
invent a competing ledger format.

The new record contains only `version`, `date`, and `targets`:

- A normal release uses the Server/App product version at `version`, publishes `server` at that
  version, and sets every unchanged target to `null`.
- A Computer-only release uses `version: null`, publishes only `computer`, and sets the other
  targets to `null`.
- A published App matches the main version. Published iOS and Computer targets carry their
  independent versions; iOS also carries its next unused build number.
- A release draft may use `date: null` and `"undecided"` target values only in the newest entry.
  Complete every decision and set the date before merge.

The ledger is the immutable publication decision, not a mutable run log. Keep workflow, deployment,
and smoke evidence in GitHub and the final handoff; never edit an old entry to change an outcome.

Update the release changelog entry and target-owned version metadata in the same PR. Keep the
changelog user-facing; keep operational evidence in the record and final handoff. Run the relevant
local gates, `git diff --check`, and the documentation check before opening the PR.

Completion criterion: one new valid record describes every target and version/build input without
changing historical entries.

## 3. Open and merge one release PR

Create one release PR from an up-to-date branch based on `origin/main`. Its body should show:

- the release version(s), source context, and the appended record;
- a target table with publish/unchanged decisions and reasons;
- required Computer-before-Server ordering or login-cutover checkpoints;
- local proof and expected target-job proof;
- the separate manual Server promotion and rollback plan;
- the exact operator handoff still needed after publication.

Do not create one PR per target, publish from the PR branch, push a release tag by hand, or merge
around a failing check. Use the repository's normal `gh`/GitHub workflow and approval policy. Merge
only after the PR is approved and all required checks are green.

Completion criterion: the single release PR is merged, and its merge commit SHA is recorded for
workflow correlation.

## 4. Monitor the one Release workflow

Find the `Release` workflow run for the merge commit, then watch the run and each target job to
completion. Leave the merged ledger immutable; capture URLs and exact outcomes for the handoff. A
target job must prove the contract owned by its routed doc, not merely report that a command started.

Check the result in this order:

1. Confirm the workflow ran from the release PR's merge commit, not a mutable branch or unrelated
   push.
2. Confirm each selected target either published its expected artifact or failed explicitly; confirm
   each unchanged target was skipped and not silently rebuilt.
3. For Computer, verify the immutable artifact, signature, digest, source revision, protocol, public
   descriptor, and production pointer according to the Computer spec.
4. For iOS, wait for Apple processing, resolve export compliance, add the exact build to the internal
   TestFlight group, and complete the real-device smoke from the iOS doc.
5. For App, retain the signed/notarized artifact and updater evidence required by the App contract.
6. For Server, confirm the artifact is published and deployable. Publication alone is not production
   deployment.

If a target job fails, preserve the failure and logs, diagnose the failed boundary, and use only a
documented idempotent retry. Never overwrite immutable bytes or silently change target decisions
after the workflow starts. Record any rerun and its reason.

Completion criterion: the one workflow has a terminal result, every target has an explicit outcome,
and the evidence links the merge commit, run, artifacts, and verification gaps.

## 5. Promote Grotto Server separately

When `server` publishes, manually dispatch `Deploy Grotto Server` for the exact published version
and source identity. Monitor the deployment run to completion; dispatching it is not evidence of
success. Confirm the deployment's migration result, local activation/rollback result, public
`/healthz`, and the hosted App smoke. Read the Server deployment doc for `deploy` versus `activate`
and migration compatibility.

If Server is unchanged, record that no Server promotion was requested. If promotion fails, keep the
release outcome failed or pending, follow the documented rollback path, and do not report the release
as deployed. A database migration is its own evidence item; never imply that application rollback
reversed database changes.

Completion criterion: the exact manual deployment is healthy, explicitly pending with a named next
action, or failed with recorded recovery evidence.

## 6. Write one release handoff

After target jobs and any required manual Server promotion finish, send one operator-facing message.
Use actual evidence, not the planned record or changed files alone:

```text
Released vX.Y.Z 🚀

Required updates: <only actionable target updates, or none>
Targets: Server <version/state>; App <version/state>; iOS <version/build/state>; Computer <version/state>
Production: <deployed and healthy | published, deployment pending | failed> at <full source SHA>
What changed: <one to three user-facing sentences>
Verification: <workflow, target, smoke, deployment, and public-health evidence>
Database: <no migration | exact migration applied | exact pending/failed operation>
Next: <what the operator can test or must do first>
Links: <PR, Release run, target artifacts, and deploy run>
```

List only actionable updates in `Required updates`, naming the exact version and action. Still list
all four targets with their actual published/deployed state. Distinguish `published` from `deployed`,
name failed or missing proof, and describe destructive data work and recoverability.

Completion criterion: one concise handoff matches the release decision and terminal evidence and
links every material claim.

## Closeout

Leave the repository and ledger in the state established by the merged release PR. Do not create
follow-up release metadata edits merely to make the handoff look green. Report the PR, merge SHA,
workflow run, target evidence, Server deployment evidence, handoff, and any unverified item.
