---
name: release-grotto
description: Prepare, merge, monitor, and hand off a Grotto release across the Server, App, iOS, Computer, and Grotto Agent targets. Use for release target decisions, append-only `releases.json` records, the single release PR, the post-merge `Release` workflow, production Server promotion, or release evidence.
---

# Grotto release

Use this skill for the release procedure. Durable artifact, protocol, installation, update, and
deployment contracts remain in the routed docs and specs below; do not recreate them here.

## Operating contract

- One release has one append-only `releases.json` record, one release PR, and one `Release`
  workflow run after that PR merges.
- Every new record has a non-null public Grotto SemVer at `version`, including component-only
  releases. Historical versionless Computer-only records remain immutable.
- The record uses exact `targets` keys: `server`, `app`, `ios`, `computer`, and `agent`. A published target
  carries its version; an unchanged target is `null`; iOS publication carries `{ version,
  buildNumber }`.
- The `Release` workflow owns per-target build, signing, publication, and evidence jobs. It runs
  selected target jobs and reports every unselected target as unchanged.
- Release publication makes artifacts available. When Server publishes, the Release graph enters
  the protected `production` Environment and calls `Deploy Grotto Server` automatically. The
  release PR is the only human authorization boundary: merge requires either a non-author GitHub
  `APPROVED` review or, when agent and operator share a GitHub identity, explicit operator
  authorization bound to the exact PR number and current head SHA. Do not call a release
  production-ready until deployment and public checks succeed.
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

Before assigning versions or editing release metadata, run:

```sh
bun run release:collect-changelog-context
```

The helper compares each target with its own last recorded release source and classifies pending
inputs as `required`, `review`, or `unchanged`. Required targets are the publication floor. Agent
judgment may add targets and resolves every review result, but it must not mark a required target
unchanged. Inspect the complete evidence, including generated files and shared contracts. Record a
target as `publish` when its shipped behavior or artifact changes:

| Target | Select `publish` for |
| --- | --- |
| `server` | Hosted API, persistence, Server behavior, or the web App artifact served by Server |
| `app` | Electron shell, preload bridge, native desktop behavior, or installed desktop artifact |
| `ios` | Native iPhone code, metadata, entitlements, dependencies, or assets |
| `computer` | Computer execution, lifecycle, human CLI, updater, embedded managed CLI, bootstrap/ordinary protocol, or required Computer dependency |
| `agent` | Grotto-owned Agent instructions, actions, recipes, Harness behavior, or factory guidance; publishing it also requires Server and Computer |

After reading the impact report, ask:

1. Which target owns the changed behavior, and which shared dependency consumers ship with it?
2. Does the Server require a higher Computer protocol floor? If yes, the compatible Computer
   target must publish and verify before Server promotion.
3. Does iOS publish? Choose a new positive build number; never reuse a number that reached Apple.
4. For every listed `review` file, does its diff affect each named target? Trace changed exports,
   dependencies, and generated inputs to their consumers. Record `affects` or `does not affect` with
   a reason; group files only when the same evidence applies.
5. Does the change use the login cutover sequence? Plan expanded Server, Computer, and final Server
   checkpoints and their rollback order from the cutover contract.

Do not widen a target merely because a release is coordinated. Every target decision needs a short
reason tied to the diff or to a prerequisite.

Assign SemVer and any iOS build number only after target scope is settled.

Completion criterion: every required target publishes, every review file has an explicit disposition
for each named target, and each selected target has an exact version/build decision.

## 2. Prepare the append-only record

Before editing, read the existing `releases.json` and ledger validator. Preserve every prior record and
append exactly one planned release record at the end. Never sort, compact, rewrite, delete, or amend
an earlier release entry. If the file or validator is missing, stop and route the contract gap; do not
invent a competing ledger format.

The new record contains only `version`, `date`, and `targets`:

- `version` is the next public Grotto SemVer. It is always non-null and increases for every release,
  including a release that publishes only Computer, App, iOS, or another component.
- Each published target carries its own next SemVer. Every unchanged target is `null`; its effective
  version carries forward from the latest earlier publication.
- Published iOS also carries its next unused build number.
- Grotto Agent carries independent SemVer in the release record; publish it only with matching
  Server and Computer targets.
- A release draft may use `date: null` and `"undecided"` target values only in the newest entry.
  Complete every decision and set the date before merge.

The ledger is the immutable publication decision, not a mutable run log. Keep workflow, deployment,
and smoke evidence in GitHub and the final handoff; never edit an old entry to change an outcome.

Write every version and iOS build decision into the new `releases.json` entry, then run `bun run
release:sync-versions`. The sync command projects that one decision into target-owned build metadata;
never edit those files independently. Then update the release changelog in the same PR. Before
writing it, read
[Grotto changelog writing](references/changelog-writing.md). Draft from the target-scoped evidence,
compare the draft with recent entries to avoid repeating an already shipped outcome, then run the
guide's deslop pass over only the new entry. Keep operational evidence in the PR and final handoff.
Run `release:check`; it rejects a required target recorded as unchanged or version metadata that
does not match the ledger. Then run the relevant local gates, `git diff --check`, and the
documentation check before opening the PR.

A focused rerun after a failed full gate is diagnostic only. Require a clean full `bun run check`
before opening or merging; preserve the original failure in PR evidence and classify it as a
product regression, environment/transient failure, or baseline/unrelated failure alongside any
focused result. A passing focused rerun does not erase or relabel the original full-gate failure.

Completion criterion: one new valid record describes every target and version/build input without
changing historical entries, and its changelog entry describes shipped outcomes without internal
churn or filler.

## 3. Open and merge one release PR

Create one release PR from an up-to-date branch based on `origin/main`. Its body should show:

- the release version(s), source context, and the appended record;
- the programmatic impact result plus publish/unchanged decisions and file-level review reasons;
- required Computer-before-Server ordering or login-cutover checkpoints;
- local proof and expected target-job proof;
- the protected Server promotion and rollback plan;
- the exact operator handoff still needed after publication.

When Server publishes, verify that GitHub's `production` Environment has no required reviewers and
permits only the `main` branch. Stop before merge if the branch restriction is missing or a second
reviewer gate is configured. The Environment scopes production credentials; the reviewed release
PR authorizes the whole post-merge graph.

Before merging, obtain either a GitHub `APPROVED` review from someone other than the PR author, or,
when agent and operator share a GitHub identity, explicit operator authorization naming the exact
PR number and current head SHA. Generic chat assent is not approval. Immediately before the merge,
re-read the PR head SHA, state, approvals, and required checks; if the head changed or the approval
does not bind that head, stop and reacquire authorization.

Do not create one PR per target, publish from the PR branch, push a release tag by hand, or merge
around a failing check. Use the repository's normal `gh`/GitHub workflow and approval policy. Merge
only after the freshly re-read PR is mergeable, the authorization gate is satisfied, and all required
checks are green.

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
4. For iOS, record the furthest proven state exactly as `uploaded`, `processing`, `processed`,
   `distributed to internal testers`, or `device-verified`; link evidence for each transition and
   follow the iOS doc for the required actions. Workflow success alone does not make iOS released.
5. For App, retain the signed/notarized artifact and updater evidence required by the App contract.
6. For Server, confirm the artifact is published and deployable. Publication alone is not production
   deployment.

If a target job fails, preserve the failure and logs, diagnose the failed boundary, and use only a
documented idempotent retry. Never overwrite immutable bytes or silently change target decisions
after the workflow starts. Record any rerun and its reason.

Completion criterion: the one workflow has a terminal result, every target has an explicit outcome,
and the evidence links the merge commit, run, artifacts, and verification gaps.

## 5. Verify automatic Grotto Server promotion

When `server` publishes, the Release workflow calls `Deploy Grotto Server` for the exact published
version and source identity automatically after the release PR merges. The protected `production`
Environment scopes credentials and accepts only `main`; it does not require a second reviewer.
Monitor the deployment to completion. Confirm the migration result, local activation/rollback
result, public `/healthz`, and hosted App smoke. Use manual `deploy` or `activate` only for recovery
and read the Server deployment doc first.

If Server is unchanged, record that no Server promotion was requested. If promotion fails, keep the
release outcome failed or pending, follow the documented rollback path, and do not report the release
as deployed. A database migration is its own evidence item; never imply that application rollback
reversed database changes.

Completion criterion: the exact automatic deployment is healthy or failed with recorded recovery
evidence.

## 6. Write one release handoff

After target jobs and any required Server promotion finish, send one operator-facing message. A
terminal workflow may still require a `pending operator` handoff while iOS processing, internal
distribution, or device verification remains outstanding.
Use actual evidence, not the planned record or changed files alone:

```text
Grotto release vX.Y.Z 🚀

Status: <released | pending operator | failed>

Required updates: <only actionable target updates, or none>
Targets: Server <version/state>; App <version/state>; iOS <version/build/furthest proven state>; Computer <version/state>; Grotto Agent <version/state>
Production: <deployed and healthy | published, deployment pending | failed> at <full source SHA>
What changed: <one to three user-facing sentences>
Verification: <workflow, target, smoke, deployment, and public-health evidence>
Database: <no migration | exact migration applied | exact pending/failed operation>
Next: <what the operator can test or must do first>
Links: <PR, Release run, target artifacts, and deploy run>
```

List only actionable updates in `Required updates`, naming the exact version and action. Still list
all five targets with their actual published/deployed state. For iOS, use only the exact furthest
proven state above; never call it `released` before the required state is evidenced. Distinguish
`published` from `deployed`, name failed or missing proof, and describe destructive data work and
recoverability.

Completion criterion: one concise handoff matches the release decision and terminal evidence and
links every material claim.

## Closeout

Leave the repository and ledger in the state established by the merged release PR. Do not create
follow-up release metadata edits merely to make the handoff look green. Report the PR, merge SHA,
workflow run, target evidence, Server deployment evidence, handoff, and any unverified item.
