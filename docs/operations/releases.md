---
summary: Coordinated release workflow for Server, App, iOS, and Computer, including signing, publishing, prerequisite ordering, and promotion.
read_when:
  - cutting, signing, notarizing, or publishing a Grotto release
  - deciding whether a Grotto release needs a Computer release
  - changing Computer packaging, protocol, updater, or release progress
  - changing release scripts, updater metadata, or release environment variables
---

# Releases

Every release starts with one Grotto release decision across Server, App, iOS, and
Computer. A surface may remain
unchanged, but the release notes must say so. Independently versioned artifacts
are prerequisites in one ordered release train, not isolated release projects.

Server and App share the main Grotto release version. iOS and Computer are independently
versioned. Computer must be published first when a Server change requires a newer protocol;
an iOS build marked for publication must reach App Store Connect before Server promotion.

## Agent Release Decision

Before every release, inspect the changed files and record every surface:

| Surface | Publish when |
| --- | --- |
| Server | Grotto App React UI, hosted API, persistence, or Server behavior changes |
| App | The Electron shell, preload bridge, or native desktop artifact changes |
| iOS | The native iPhone app or its release metadata, entitlements, dependencies, or assets change |
| Computer | Computer execution, lifecycle, local CLI, updater, embedded managed CLI, bootstrap or ordinary protocol, or a required shared Computer dependency changes |

`release:bump` resets `release-surfaces.json`. Set every surface to `publish`
with its version or `unchanged`, then copy the exact block from
`release:collect-changelog-context` into the new changelog entry.
`release:check` and production publishers reject missing or inconsistent
decisions. For a Computer-only repair, leave `targetVersion` null, publish the
Computer version, mark Server, App, and iOS unchanged, and record
the generated surface block in the current changelog entry.

If Server raises its required Computer protocol, publish and publicly verify
the compatible Computer release first. The Server publisher must not proceed
against a production Computer descriptor below that floor.

## Release Handoff

Every completed release ends with one operator-facing chat message. This
handoff is part of the release contract. Derive it from
`release-surfaces.json`, publisher output, deployment state, and live health;
do not infer a successful release or required user action from the changed
files alone.

Use this compact shape:

Released **vX.Y.Z** 🚀

### Required updates

When no installed surface requires an update:

✅ All changes were deployed to the Grotto Server. No Grotto App, Grotto iOS, or
Grotto Computer updates are required.

When updates are required, list only those actionable updates:

- 🖥️ **Grotto App**: Update to `vX.Y.Z` using `exact action`.
- 📱 **Grotto iOS**: Install `vX.Y.Z (build N)` from TestFlight.
- 💻 **Grotto Computer**: Update to `vX.Y.Z` using `exact command or UI action`.

### Release versions

- Grotto Server: `vX.Y.Z`
- Grotto App: `vX.Y.Z`
- Grotto iOS: `vX.Y.Z (build N)`
- Grotto Computer: `vX.Y.Z`

### Release details

- 🚦 **Production**: `deployed and healthy | published, deployment pending | failed`
  at `short source SHA`, with release and deployment links when available.
- ✨ **What changed**: `one to three user-facing sentences`.
- ✅ **Verification**: `release checks, focused tests, artifact checks, deployment,
  and public health evidence`.
- 🗄️ **Database**: `✅ No migration required | ✅ Applied exact migration |
  ❌ exact failed or pending operation`.
- ➡️ **Next**: `what the operator can test now or must do before testing`.

Put required updates immediately after the release outcome and before the version
inventory. Do not enumerate unchanged surfaces in that section; use the single green-check
sentence when no installed surface needs action. Every handoff must then list all four
currently versioned surfaces and their actual deployed or published versions. For an unchanged
surface, resolve the latest published artifact version rather than copying the current Server
package version or the release target. Keep emoji limited to the semantic markers shown above
so the handoff remains scannable rather than decorative.
“Published” and “deployed” are different states: do not call production ready
until the production deployment and public health checks pass. Every required update
must name the version and exact action. Name destructive data work,
what it removed, and whether recovery is possible. Report failed checks,
pending deployment, and other verification gaps directly instead of omitting
them.

## Server Release Flow

1. Run `bun run release:bump <patch|minor|major|X.Y.Z>`.
2. Run `bun install --frozen-lockfile`.
3. Run `bun run release:collect-changelog-context`.
4. Update the top `CHANGELOG.md` entry from the commit context.
5. Run `bun run release:check`.
6. Run `bun run release:publish` from macOS with signing, notarization, updater,
   S3, and GitHub auth configured.

`release:publish` commits and pushes release metadata first so the future tag
commit has a stable full SHA. It builds the Server artifact, including Grotto App,
once with that SHA, verifies its archive and sidecar, then builds and
notarizes the signed App when required. It uploads the App updater files to
`GROTTO_RELEASE_S3_URI`, verifies that remote `main` still contains the release
commit, pushes the version tag, and creates the GitHub Release with the App
files plus the Server archive and sidecar. New commits may land on `main` during
the build without invalidating the immutable release commit.

## Hosted Server Promotion

The Server and Grotto App use the same product version from `apps/website`.
They are one atomic production artifact with one Server SemVer. Ordinary React UI changes do not
require an Electron App release. An App release is required only
when the native shell or preload bridge changes. The publisher reads the
release-surface decision and skips App building, notarization, updater
upload, and GitHub artifacts when App is unchanged.

Publishing the annotated `vX.Y.Z` GitHub Release makes the version deployable;
it does not promote production. A manual `Deploy Grotto Server` dispatch
resolves that immutable tag to its full commit SHA, downloads only the matching
Server archive and sidecar through the authenticated GitHub Release API, verifies them, installs the
release under that full SHA, then atomically activates it. The mini does not
install JavaScript dependencies or rebuild release source. Human-facing
identity is `X.Y.Z`; deploy, rollback, audit, and artifact identity use the full
source SHA and content digest.

The `Deploy Grotto Server` Actions workflow is the only manual promotion
surface. It accepts an exact existing published, non-draft, non-prerelease
`vX.Y.Z` and either:

* `deploy`: download, verify, install, and activate that published artifact
* `activate`: verify and switch to that already installed release without a
  download or rebuild

Both paths run the candidate release's compiled migration program with the
workflow-held database credential, then invoke the root-owned activation helper.
The workflow records the exact applied migration and success state in its job
summary. A migration failure leaves the running release untouched. Database
migrations are not rolled back when application health rollback restores an
older release, so every migration must remain compatible with that older
release.

`activate` validates the published tag and the already-installed release; it
does not require release assets. This preserves rollback to an installed
transitional release whose GitHub Release predates hosted Server assets.

It does not accept branches, `main`, arbitrary SHAs, draft releases, or
prereleases. Cut an annotated patch release for an urgent fix. Computer retains its independent
version and operator-triggered publisher, but its decision and prerequisite order belong to this
release workflow.

## Computer Release Contract

The normative packaging, signing, installation, rollback, progress UX, and
acceptance contract is
[Grotto Computer release and update](../../specs/raft-alignment/computer-release-and-update.md).

Grotto Computer has independent SemVer, `computer-vX.Y.Z` tags, and one
production stream. Its latest descriptor is a JSON document at
`GROTTO_COMPUTER_RELEASE_MANIFEST_URL` (default
`https://releases.grotto.sh/computer/latest.json`):

```json
{
  "release": {
    "artifactUrl": "https://releases.grotto.sh/computer/X.Y.Z/grotto-computer-aarch64-apple-darwin",
    "protocolVersion": 7,
    "sha256": "<lowercase artifact sha256>",
    "sourceRevision": "<full lowercase git sha>",
    "version": "X.Y.Z"
  },
  "signature": "<base64 Ed25519 signature>"
}
```

The signature covers the compact JSON release object in the documented key
order. The signed and notarized standalone executable embeds the Ed25519 public
key and managed Grotto CLI. It installs at
`~/.local/bin/grotto-computer`; npm, Homebrew, and Bun are not installation or
recovery dependencies. Failed verification never reaches executable
replacement or attachment/Agent data.

Starting the Computer never checks or installs a release. An Owner or Admin
must choose **Check** and **Update** in the attached Server's Computer settings,
or an operator must run `grotto-computer upgrade` locally. There are no channels,
pins, prerelease tracks, or automatic startup installs. The updater retains one
previous verified executable for explicit `grotto-computer upgrade --rollback`.

## Computer Release Flow

Reusable-login protocol changes use the ordered
[Computer login cutover](computer-login-cutover.md): expanded Server, publicly verified Computer,
then final Server. Its rollback order is part of the contract.

Use this lane when the release decision marks Computer **publish**:

1. Choose the next independent Computer SemVer.
2. Run `bun run computer:release -- --dry-run <version>`.
3. Update the changelog with the Computer version and any Server dependency.
4. Run `bun run computer:release <version>` from macOS with Apple, Ed25519, S3,
   Git, and GitHub credentials configured.
5. Confirm the publisher publicly verified the immutable executable and signed
   descriptor before promoting `computer/latest.json`.
6. If Server requires the new protocol, only then continue its release flow.

The publisher creates the annotated Computer tag and GitHub Release. It never
promotes `latest.json` before the immutable public artifact passes signature,
notarization, digest, version, protocol, and source-revision checks.
The compiled artifact must also load every embedded Codex, Claude Code, and Grok Build harness
bridge payload, including Grok Build's live interjection extension. Grok Build itself remains the
user's detected local installation. The publisher runs the bridge check from the standalone
executable, so source-tree fallback files cannot make a broken release pass.

The deterministic bridge contract test pins the private `_x.ai/interject` method, its first-update
readiness gate, and its accepted/rejected acknowledgement handshake. The Computer suite
automatically runs an authenticated smoke against the separately installed Grok executable when
`grok models` confirms a usable local login. CI and developer machines without Grok or a usable
login skip only that live smoke; no opt-in flag is required.

If publication is interrupted after an immutable object uploads but before
promotion, rerun the same command from the same source revision. The publisher
recovers an existing executable only after verifying its Apple identity,
version, protocol, and full source revision, and reuses other immutable objects
only when their SHA-256 digests match. It never overwrites differing immutable
bytes.

The pre-publisher 1.0.0 development install is a one-time clean transition, not
a Computer release lane. Run the new standalone installer and setup command; it
reuses `~/.grotto` state. Do not publish an npm compatibility bridge.

## iOS Release Flow

The native iPhone app has independent SemVer and a monotonically increasing positive integer build
number. Its App Store identity is `build.grotto.ios`. A TestFlight upload is a published iOS
surface; inviting testers is the separate promotion step.

Use the one-time account and app-record setup in [iOS TestFlight](ios-testflight.md) before the
first upload. The published iOS version and build number always come from explicit `xcodebuild`
arguments that `bun run ios:release` derives from the `release-surfaces.json` decision, never from
`Grotto.xcodeproj`/`project.yml`; see [Version and build number](ios-testflight.md#version-and-build-number).
`project.yml`'s baked-in `MARKETING_VERSION` is a local-build default only, kept in sync with the
Server/App release version by `release:bump`. For every release marked iOS **publish**:

1. Choose the iOS version and next unused build number, and record both in
   `release-surfaces.json`.
2. Run `bun run ios:release <version> --build-number <number> --dry-run`.
3. Run `bun run ios:release <version> --build-number <number>` from macOS with signing and App
   Store Connect access configured.
4. Wait for Apple processing and resolve any export-compliance prompt.
5. Add the processed build to the internal TestFlight group and complete a real-device smoke.
6. Only then promote the coordinated Server release.

If an upload reaches Apple but the release train later stops, do not reuse its build number. Keep
that build in App Store Connect or expire it, increment the build number, update the release
decision and changelog block, and upload again.

## Release Artifact Inventory

App builds compile `assets/mac-icon.icon` with Xcode `actool` before Electron
packaging. The compiled `Assets.car` provides the layered Liquid Glass app icon
on macOS 26, and `AppIcon.icns` remains the fallback icon for older macOS
versions and Electron's DMG/app bundle path.

Grotto releases publish these production artifacts:

* `Grotto.app` (`build.grotto.desktop`) is the installed Grotto App. App release files use the
  `Grotto_<version>_<arch>` prefix.
* `build.grotto.ios` is uploaded to App Store Connect and promoted through TestFlight. The iOS
  version and build number are recorded in the coordinated release decision.
* `grotto-server-<version>+git.<short-sha>-aarch64-apple-darwin.tar.gz`
  contains Server and Grotto App. Its sidecar travels with it as a
  GitHub Release asset.
* `computer/<version>/grotto-computer-aarch64-apple-darwin` is the independently
  versioned, signed and notarized Computer executable. Its signed descriptor is
  published immutably beside it before `computer/latest.json` is promoted.

Keep every published changelog version anchored by a matching `vX.Y.Z` git tag
or a `release: vX.Y.Z` commit. The changelog context command uses that anchor to
collect changes for the next release.

## Environment

Release commands resolve everything they need from the committed `.env.schema`.
Each one runs `GROTTO_RESOLVE_RELEASE_TOKENS=true varlock run --include-internal`,
so the Tooling-vault credentials resolve through desktop authorization (Touch
ID) on the publisher's machine and nowhere else. There is no `.env` step, and
nothing else may resolve them: cloud agents, CI, and the dev stack never
evaluate these references. See [environment.md](environment.md).

What the schema supplies:

* `GROTTO_RELEASE_BASE_URL`, `GROTTO_RELEASE_S3_URI`, `APPLE_TEAM_ID`, and
  `APPLE_SIGNING_IDENTITY` — public literals.
* `VITE_CLERK_PUBLISHABLE_KEY` for the Grotto App inside the Server artifact —
  a public literal, selected by the release switch rather than the lifecycle. A
  release always resolves the *development* lifecycle, because the production
  1Password instance refuses desktop authorization, so the lifecycle cannot say
  whether a build ships. `GROTTO_RESOLVE_RELEASE_TOKENS=true` can, and it
  selects the production Clerk instance. `build-grotto-server-artifact` then
  asserts the resolved key is a `pk_live_` key before building the App bundle,
  so a development Clerk instance cannot reach an artifact users run.
* `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD` from the shared
  `Apple Notarization - Merchbase` Tooling item.
* `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from the shared
  `S3 Release - Merchbase Desktop` Tooling item.
* `GROTTO_COMPUTER_RELEASE_PRIVATE_KEY` and
  `GROTTO_COMPUTER_RELEASE_PUBLIC_KEY` from `Computer Release Signing - Grotto`.

What stays on the operator's machine:

* The Developer ID certificate and its private key, in the login Keychain.
  Only the identity's *name* travels, and it is public. `build-desktop-release`
  bridges it onto electron-builder's literal `CSC_NAME`.
* The App Store Connect `.p8` file for iOS TestFlight uploads. No key has been
  issued for Grotto yet, so `APPLE_API_KEY_PATH`, `APPLE_API_KEY_ID`, and
  `APPLE_API_ISSUER` are operator-supplied for now; iOS releases also need
  `IOS_DEVELOPMENT_TEAM` (or `APPLE_TEAM_ID`) and an Apple Developer account
  configured in Xcode.

Computer releases verify the Ed25519 pair and the current production descriptor
before building. The public key is compiled into the Computer executable; normal
installation does not accept a public-key environment override. Computer objects
publish below the `computer/` prefix of `GROTTO_RELEASE_S3_URI`, and
`GROTTO_COMPUTER_RELEASE_BASE_URL` is `https://releases.grotto.sh/computer`.

The GitHub Release step uses `gh`; run `gh auth status` before publishing.
