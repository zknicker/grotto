---
summary: Expand/contract release train and production smoke for reusable Grotto Computer login.
read_when:
  - releasing a Server or Computer change to login, setup, attachment, or device authorization
  - removing a temporary Computer protocol compatibility path
  - running the production first-Computer onboarding smoke
---

# Computer Login Cutover

Reusable Computer login ships through three checkpoints: expanded Server, Computer, then final
Server. Never activate the contracted Server before the new Computer is publicly available and
the production Computer has upgraded. Grotto App and Server are one artifact, so the last
checkpoint activates both together.

Choose and record the three release versions plus the rollback Server version before starting:

```sh
export EXPANDED_SERVER_VERSION=X.Y.Z
export COMPUTER_VERSION=X.Y.Z
export CUTOVER_SERVER_VERSION=X.Y.Z
export PREVIOUS_SERVER_VERSION=X.Y.Z
```

Also record the full source SHA for the expansion release, cutover release, current production
Server release, and current production Computer descriptor. Run every command from a clean macOS
checkout of the recorded source. Release metadata and changelog preparation use the normal
[release workflow](releases.md).

## 1. Expanded Server

The expansion source must accept both the previous one-off setup protocol and reusable login plus
`POST /computer/attach`. Before publishing, prove all three compatibility directions:

```sh
cd apps/computer
bun test src/index.test.ts -t 'setup stores only a Server credential and reruns by validation'
bun test src/attach.test.ts src/setup-resume.test.ts
cd ../server
bun test test/grotto-server-onboarding.test.ts
bun test test/grotto-computer-login.test.ts test/grotto-computer-attach.test.ts
cd ../website
bun e2e/run-playwright.ts e2e/tests/servers.spec.ts e2e/tests/computer-login.spec.ts
cd ../..
```

Prepare and publish the expansion Server release, marking Computer, App, and Runtime
unchanged unless their own diffs require publication:

```sh
bun run release:bump "$EXPANDED_SERVER_VERSION"
bun install --frozen-lockfile
bun run release:collect-changelog-context
# Complete CHANGELOG.md and release-surfaces.json with the reviewed surface decision.
bun run release:check
bun run release:publish
```

The published `v$EXPANDED_SERVER_VERSION` release deploys automatically. Verify the workflow and
public health, then run setup once with the currently published Computer. Do not proceed unless its
existing attachment, workspace, and Agent remain available after reconnect.

Rollback checkpoint: activate the previously recorded Server release. No Computer rollback is
needed because no Computer has changed. Dispatch alone is not rollback proof; wait for the exact
workflow run and public health before continuing:

```sh
SERVER_ROLLBACK_RUN_URL="$(
  gh workflow run deploy-grotto-server.yml \
    -f version="v$PREVIOUS_SERVER_VERSION" -f mode=activate
)"
test -n "$SERVER_ROLLBACK_RUN_URL"
gh run watch "${SERVER_ROLLBACK_RUN_URL##*/}" --exit-status
curl --fail --silent --show-error https://grotto.sh/healthz
```

## 2. Computer

From the cutover source, set `apps/computer/package.json` to `$COMPUTER_VERSION`. Prepare a
Computer-only `release-surfaces.json`: Computer publishes `$COMPUTER_VERSION`; Server,
App, and Runtime are unchanged; `targetVersion` is `null`. Update the current changelog entry
with that exact surface block. The dry run deliberately does not validate this metadata, so check
and commit it before building:

```sh
bun install --frozen-lockfile
bun run release:collect-changelog-context
# Complete CHANGELOG.md and release-surfaces.json with the reviewed Computer-only decision.
bun run release:check
git diff --check
git add CHANGELOG.md apps/computer/package.json release-surfaces.json
git commit -m "chore(release): prepare Computer $COMPUTER_VERSION"
# Land that reviewed commit on main, then prove this exact source is present there.
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
bun run computer:release -- --dry-run "$COMPUTER_VERSION"
bun run computer:release "$COMPUTER_VERSION"
curl --fail --silent --show-error \
  https://releases.grotto.sh/computer/latest.json
```

Upgrade the production Computer through Grotto App or run `grotto-computer upgrade`. Verify the new
version, every pre-existing Server attachment, and an existing Agent workspace before continuing:

```sh
$HOME/.local/bin/grotto-computer version
$HOME/.local/bin/grotto-computer status
$HOME/.local/bin/grotto-computer doctor
```

Rollback checkpoint: while the expanded Server remains active, run
`grotto-computer upgrade --rollback`, then recheck status and one existing workspace. Do not roll
the Computer back by itself after the contracted Server activates.

## 3. Final Server

The cutover source removes the one-off Server endpoints and PostgreSQL model, Computer fallback,
and browser route. It does not drop or rewrite the production database; existing Computer rows,
credentials, attachments, and workspaces stay in place. Prepare and publish the final Server
release with Computer marked **publish** at the exact version already published. This does not
republish Computer: it makes `release:publish` reject the final release unless the signed production
descriptor is exactly `$COMPUTER_VERSION`. Mark App and Runtime unchanged:

```sh
bun run release:bump "$CUTOVER_SERVER_VERSION"
bun install --frozen-lockfile
bun run release:collect-changelog-context
# Set Computer to publish $COMPUTER_VERSION in CHANGELOG.md and release-surfaces.json.
bun run release:check
bun run release:publish
```

Confirm the published release deployed, `/healthz` is healthy, Grotto App loads, and the
production Computer reconnects. Then run the clean-root smoke below.

Rollback checkpoint: first reactivate the expanded Server release, then roll Computer back only if
needed. Wait for successful Server activation and public health before changing Computer; dispatching
the workflow is not sufficient:

```sh
SERVER_ROLLBACK_RUN_URL="$(
  gh workflow run deploy-grotto-server.yml \
    -f version="v$EXPANDED_SERVER_VERSION" -f mode=activate
)"
test -n "$SERVER_ROLLBACK_RUN_URL"
gh run watch "${SERVER_ROLLBACK_RUN_URL##*/}" --exit-status
curl --fail --silent --show-error https://grotto.sh/healthz
$HOME/.local/bin/grotto-computer upgrade --rollback
```

Never reset PostgreSQL, delete the Computer data root, or replace production attachment files as a
rollback step.

## Production Smoke From A Clean Data Root

Run this smoke from a dedicated macOS Unix account or separate host that does not own an existing
Grotto Computer service. A temporary data root isolates Computer files, but `logout` intentionally
stops the account-wide `com.grotto.computer` launchd service; running it as the production Computer
account would take existing attachments offline. Prove the smoke account has no service plist and
uses the published executable, then create a fresh Server in the production Grotto App and record its exact
slug and Server id:

```sh
test ! -e "$HOME/Library/LaunchAgents/com.grotto.computer.plist"
test -x "$HOME/.local/bin/grotto-computer"
$HOME/.local/bin/grotto-computer version
export SMOKE_SERVER_SLUG=replace-with-recorded-slug
export SMOKE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/grotto-computer-smoke.XXXXXX")"
GROTTO_COMPUTER_DATA_ROOT="$SMOKE_ROOT/computer" \
  GROTTO_SERVER_ORIGIN=https://grotto.sh \
  $HOME/.local/bin/grotto-computer setup "/$SMOKE_SERVER_SLUG"
```

In the browser, verify device code prefill, explicit account approval, **Signed in — finishing the
connection**, then **Computer connected** only after the CLI stores the attachment. In Grotto App,
verify the Server observes the Computer, onboarding advances only after runtime/model inventory,
the Owner selects Cove's model, and Grotto App unlocks into the retained onboarding Channel. Verify
Cove appears as an implicit DM peer without a Chat row; opening it stays non-persistent. If Cove's
first greeting is enabled, verify that Agent-authored send materializes one canonical DM and one
canonical message.

Record the Computer id, attachment path under the isolated root, Cove id, DM id, greeting message
id, release versions, and timestamps. Before cleanup, run:

```sh
GROTTO_COMPUTER_DATA_ROOT="$SMOKE_ROOT/computer" \
  GROTTO_SERVER_ORIGIN=https://grotto.sh \
  $HOME/.local/bin/grotto-computer status
GROTTO_COMPUTER_DATA_ROOT="$SMOKE_ROOT/computer" \
  GROTTO_SERVER_ORIGIN=https://grotto.sh \
  $HOME/.local/bin/grotto-computer logout
```

Delete only the recorded smoke Server through its confirmed Grotto App flow if cleanup is authorized.
Move the exact `SMOKE_ROOT` to Trash only after evidence is captured and Server cleanup succeeds.
Never sweep Servers, Computers, attachments, or local roots by prefix or age.
