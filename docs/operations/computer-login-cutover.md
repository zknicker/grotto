---
summary: Expand/contract release ordering and production smoke for reusable Grotto Computer login.
read_when:
  - releasing a login, setup, attachment, or device-authorization change
  - removing a temporary Computer protocol compatibility path
  - running the production first-Computer onboarding smoke
---

# Computer login cutover

Reusable Computer login uses three ordered checkpoints:

1. expanded Server accepts the old and reusable-login paths;
2. the compatible Computer is published, upgraded, and verified;
3. final Server removes the temporary path.

Never activate the contracted Server before the new Computer is publicly available and the
production Computer has upgraded. Grotto App and the hosted Server are one artifact, so the final
Server checkpoint activates both together.

Use the [Grotto release skill](../../.agents/skills/release-grotto/SKILL.md) for each distinct
checkpoint's append-only release record, one release PR, one post-merge `Release` workflow, and
manual Server promotion. This document owns the sequence, rollback order, and smoke evidence. A
three-checkpoint cutover is three sequential release decisions when the versions differ; it is not
three target PRs for one release.

## Expanded Server

The expanded Server accepts both the previous one-off setup protocol and reusable login plus
`POST /computer/attach`. Before promotion, prove the compatibility directions with the focused
Computer, Server, and App tests named by the current code and testing guide.

After the `server` target publishes and the manual Server deployment is healthy, run setup once
with the currently published Computer. Confirm its existing attachment, workspace, and Agent
remain available after reconnect. Keep the recorded previous Server release as the rollback point.

Do not continue if the compatibility test, deployment, public health, or reconnect evidence is
missing.

## Computer

Publish the independent `computer` target from the cutover source. The release record names the
Computer version, protocol, source identity, and the expanded Server prerequisite. The target job
must prove the signed standalone artifact and public descriptor from the
[Computer release and update spec](../../specs/raft-alignment/computer-release-and-update.md).

Upgrade the production Computer through Grotto App or the local recovery command:

```sh
grotto-computer upgrade
```

Verify the new version, every pre-existing Server attachment, and an existing Agent workspace:

```sh
$HOME/.local/bin/grotto-computer version
$HOME/.local/bin/grotto-computer status
$HOME/.local/bin/grotto-computer doctor
```

While the expanded Server remains active, rollback is `grotto-computer upgrade --rollback` followed
by status and workspace checks. Do not roll the Computer back by itself after the contracted Server
activates.

## Final Server

The final Server source removes the one-off endpoints, PostgreSQL model, Computer fallback, and
browser route. It does not drop or rewrite production data; existing Computer rows, credentials,
attachments, and workspaces remain in place.

Record the already-published Computer version as the prerequisite. Do not republish Computer for
the final Server checkpoint. Mark only the final Server target for publication unless the diff
proves another target changed. Promote the final Server manually, then confirm public health,
Grotto App loading, and Computer reconnect.

Rollback order is strict: reactivate the expanded Server release first, wait for successful health,
then roll Computer back only if needed. Never reset PostgreSQL, delete the Computer data root, or
replace production attachment files as rollback.

## Production smoke from a clean data root

Run the smoke from a dedicated macOS account or separate host that does not own an existing Grotto
Computer service. A temporary data root isolates files, but `logout` stops the account-wide
`com.grotto.computer` service; never run this smoke as the production Computer account.

Prove the smoke account has no service plist and uses the published executable, then create a fresh
Server in the production Grotto App and record its exact slug and Server id. Run setup against that
recorded Server with an isolated `GROTTO_COMPUTER_DATA_ROOT`.

Verify device-code prefill, explicit account approval, **Signed in — finishing the connection**,
and **Computer connected** only after the CLI stores the attachment. In Grotto App, verify the
Server observes the Computer, onboarding advances only after runtime/model inventory, the Owner
selects Cove's model, and the App unlocks into the retained onboarding Channel. Verify Cove's
implicit DM behavior and, when enabled, exactly one canonical greeting DM/message.

Record the Computer id, isolated attachment path, Cove id, DM/message ids, release versions, and
timestamps before cleanup. Inspect status and log out with the isolated root. Delete only the
confirmed smoke Server through its Grotto App flow when cleanup is authorized, then move only the
recorded temporary root to Trash. Never sweep Servers, Computers, attachments, or local roots by
prefix or age.
