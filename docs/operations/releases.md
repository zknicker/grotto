---
summary: Coordinated release workflow for App/Server, Desktop, Computer, and remaining Runtime artifacts, including signing, publishing, compatibility ordering, and promotion.
read_when:
  - cutting, signing, notarizing, or publishing a Grotto release
  - deciding whether a Grotto release needs a Computer release
  - changing Computer packaging, protocol, updater, or release progress
  - deciding whether a Grotto app release needs a Runtime release
  - changing Runtime release artifacts or Homebrew deployment
  - changing release scripts, updater metadata, or release environment variables
---

# Releases

Every release starts with one Grotto release decision across App/Server,
Desktop, Computer, and any remaining Runtime surface. A surface may remain
unchanged, but the release notes must say so. Independently versioned artifacts
are prerequisites in one ordered release train, not isolated release projects.

Grotto releases optimize for frequent app updates and infrequent Runtime updates.
The desktop app has its own release version. Runtime has a package version, and
the app declares the minimum compatible Runtime version in
`apps/website/package.json` at `tavern.runtime.minimumVersion`.

Users experience app and Runtime updates as one Grotto update. The desktop
updater stages a Runtime package first when a newer Runtime is required, keeps
the existing Runtime process online, downloads the desktop update, then asks for
one restart. The final restart restarts Runtime, waits for Runtime health, and
then restarts the app when an app update is staged.

The app accepts a connected Runtime when:

* the Runtime version is exactly the app version, or
* the Runtime version is in the same Runtime API epoch as
  `tavern.runtime.minimumVersion` and is greater than or equal to that floor.

The Runtime API epoch is `major.minor`. Patch releases inside the same epoch are
compatible unless the app raises the floor.

## Agent Release Decision

Before every release, inspect the changed files and record every surface:

| Surface | Publish when |
| --- | --- |
| App/Server | Product UI, hosted API, hosted persistence, or Server behavior changes |
| Desktop | The Electron shell or bundled desktop artifact changes |
| Computer | Computer execution, lifecycle, local CLI, updater, embedded managed CLI, bootstrap or ordinary protocol, or a required shared Computer dependency changes |
| Runtime | A remaining pre-Computer Runtime package contract changes |

`release:bump` resets `release-surfaces.json`. Set every surface to `publish`
with its version or `unchanged`, then copy the exact block from
`release:collect-changelog-context` into the new changelog entry.
`release:check` and production publishers reject missing or inconsistent
decisions. For a Computer-only repair, leave `targetVersion` null, publish the
Computer version, mark App/Server, Desktop, and Runtime unchanged, and record
the generated surface block in the current changelog entry.

If App/Server raises its required Computer protocol, publish and publicly verify
the compatible Computer release first. The App/Server publisher must not proceed
against a production Computer descriptor below that floor.

For the remaining Runtime surface, choose one compatibility lane:

| Lane | Use when | Runtime package | Runtime floor |
| --- | --- | --- | --- |
| App-only | UI, desktop shell, docs, app cache, app presentation, or any change that does not require a new Runtime behavior | unchanged | unchanged |
| Compatible Runtime | Runtime bugfix or operational improvement that users can safely defer because the old Runtime still preserves correct core behavior | bump with app release | unchanged |
| Required Runtime | App depends on new Runtime API, storage, capability, event, job, executor behavior, or CLI behavior; or the release fixes correctness-critical Runtime behavior | bump with app release | bump to the release version |

Default to **App-only** unless the app needs new Runtime behavior. Runtime
updates are operator work; do not force one for a desktop-only patch. When a
Runtime fix changes whether core chat execution is truthful or correct, treat it
as **Required Runtime** even if the HTTP/API shape is unchanged.

## App-Only Flow

1. Run `bun run release:bump <patch|minor|major|X.Y.Z>`.
2. Run `bun install --frozen-lockfile`.
3. Run `bun run release:collect-changelog-context`.
4. Update the top `CHANGELOG.md` entry from the commit context.
5. Run `bun run release:check`.
6. Run `bun run release:publish` from macOS with signing, notarization, updater,
   S3, and GitHub auth configured.

`release:publish` commits and pushes release metadata first so the future tag
commit has a stable full SHA. It builds the hosted Server and hosted App
artifact once with that SHA, verifies its archive and sidecar, then builds and
notarizes the signed desktop app. It uploads the desktop updater files to
`TAVERN_RELEASE_S3_URI`, verifies that remote `main` still contains the release
commit, pushes the version tag, and creates the GitHub Release with the desktop
files plus the Server archive and sidecar. New commits may land on `main` during
the build without invalidating the immutable release commit.

## Hosted Server Promotion

The hosted Server and hosted web App use the same product version as
`apps/website`. They are one atomic production artifact; there is no separate
Server SemVer.

Publishing the annotated `vX.Y.Z` GitHub Release triggers the production
deployment. A push to `main` does not. The deploy resolves that immutable tag to
its full commit SHA, downloads only the matching Server archive and sidecar
through the authenticated GitHub Release API, verifies them, installs the
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

`activate` validates the published tag and the already-installed release; it
does not require release assets. This preserves rollback to an installed
transitional release whose GitHub Release predates hosted Server assets.

It does not accept branches, `main`, arbitrary SHAs, draft releases, or
prereleases. Cut an annotated patch release for an urgent fix. Computer and any
optional Runtime artifacts retain independent versions and operator-triggered
publishers, but their decision and prerequisite order belong to this release
workflow.

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
    "protocolVersion": 3,
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

Use this lane when the release decision marks Computer **publish**:

1. Choose the next independent Computer SemVer.
2. Run `bun run computer:release -- --dry-run <version>`.
3. Update the changelog with the Computer version and any App/Server dependency.
4. Run `bun run computer:release <version>` from macOS with Apple, Ed25519, S3,
   Git, and GitHub credentials configured.
5. Confirm the publisher publicly verified the immutable executable and signed
   descriptor before promoting `computer/latest.json`.
6. If App/Server requires the new protocol, only then continue its release flow.

The publisher creates the annotated Computer tag and GitHub Release. It never
promotes `latest.json` before the immutable public artifact passes signature,
notarization, digest, version, protocol, and source-revision checks.

The pre-publisher 1.0.0 development install is a one-time clean transition, not
a Computer release lane. Run the new standalone installer and setup command; it
reuses `~/.grotto` state. Do not publish an npm compatibility bridge.

## Runtime Release Flow

Use this lane only when the Runtime package must ship.

1. Run `bun run release:bump <patch|minor|major|X.Y.Z> -- --runtime`.
2. If the app requires this Runtime version, use
   `bun run release:bump <patch|minor|major|X.Y.Z> -- --runtime --require-runtime`
   instead. This also updates `tavern.runtime.minimumVersion`.
3. Run `bun install --frozen-lockfile`.
4. Run `bun run release:collect-changelog-context`.
5. Update the top `CHANGELOG.md` entry. Name app changes and Runtime changes
   separately when both ship.
6. Run `bun run release:check`.
7. Run `bun run release:build-runtime-artifact` when validating the Runtime
   artifact before publish.
8. Run `bun run release:publish -- --runtime` from macOS.

`release:publish -- --runtime` also builds and verifies the hosted Server
artifact for the same tag, builds the Runtime artifact and signed desktop app,
notarizes it, creates updater metadata, uploads desktop updater artifacts and
Runtime tarballs to `TAVERN_RELEASE_S3_URI`, verifies each S3 object is visible,
pushes `main` and the version tag, creates the GitHub Release, and updates the
Homebrew tap formula.

Runtime artifacts include the Runtime CLI, assets, schemas, and bundled
resources required by the local service.

## Compatibility Floor Rules

* **Do not raise the floor for desktop-only work.** App version bumps do not
  imply Runtime updates.
* **Raise the floor when the app calls a new Runtime contract.** This includes
  new or changed Runtime API fields, capability ids, websocket events, durable
  records, executor behavior, Runtime CLI behavior, or adapter behavior that
  the app requires.
* **Raise the floor for correctness-critical Runtime fixes.** This includes
  fixes for chat/session binding, model selection, command routing, skill
  projection, tool execution, auth, data integrity, updater correctness, or any
  other Runtime bug where leaving users on the old Runtime would make core
  workflows silently wrong while the app still reports healthy or up to date.
* **Keep compatible Runtime fixes optional.** If a Runtime patch improves
  reliability or performance but old Runtime builds still preserve correct core
  behavior, publish the Runtime artifact without changing
  `tavern.runtime.minimumVersion`.
* **Use patch bumps inside a Runtime API epoch.** If Runtime compatibility needs
  a clean break, bump the minor version and raise the app floor to that new
  minor.
* **Verify old Runtime behavior when leaving the floor unchanged.** Run the
  focused app/server test lane against the floor contract or add a fixture-backed
  test for the field/event/capability the app consumes.

Raise `tavern.runtime.minimumVersion` when any answer is yes:

* Does the app require a new Runtime API route, request field, response field, or
  error shape?
* Does the app require a new Runtime capability id, health state, event, durable
  record, job, or storage invariant?
* Does the app require new model-provider startup, model config, or executor
  behavior?
* Does the app require new Runtime CLI, Homebrew service, artifact layout, port,
  or environment behavior?
* Does this release fix a core Runtime correctness bug in chat execution,
  session routing, model choice, commands, skills, tools, auth, data integrity,
  or updater behavior?
* Would the new app fail, hide core functionality, corrupt state, or show a
  false healthy state against the current floor Runtime?

Do not raise `tavern.runtime.minimumVersion` when every answer is no. Examples:

* UI copy, layout, navigation, visual polish, or desktop updater changes.
* App cache, optimistic UI, local settings, or presentation-only fixes.
* Runtime fixes that old app builds can use opportunistically but the new app
  does not require.
* Release tooling or documentation changes that do not change the Runtime
  artifact contract.

## User Update Contract

The Grotto updater has one visible product flow:

1. Show the topbar updater control when an app update is available, Runtime must
   be staged, a stage/download/restart is active, or the configured Runtime is
   disconnected.
2. Stage Runtime with `brew update && brew upgrade grotto-runtime`. Do not
   restart Runtime during staging.
3. Download the desktop update.
4. Show **Restart** only when every required artifact is staged.
5. On restart, restart Runtime first, wait for the minimal Runtime health check,
   then restart the desktop app when an app update is staged.

Do not reintroduce a separate Runtime update wizard or fake progress checklist.
Runtime install progress is phase-based unless Runtime owns real byte progress.
Do not use the updater control as a generic failure surface. Runtime connection
failures link to Runtime settings, where the full connection error is shown.

## Homebrew Tap

`zknicker/homebrew-grotto` is first-party Grotto release infrastructure. Treat
it as part of this repository's release surface, not as a separate downstream
project.

When Runtime install, update, service, artifact, environment, port, or CLI
behavior changes:

* update Grotto release scripts in this repository
* update the generated Homebrew formula contract
* update the tap README and any tap-local operator docs
* verify the tap still documents install, update, service control, logs, and
  environment overrides

`release:publish-homebrew-formula` owns the formula write path. It updates
`zknicker/homebrew-grotto` by default through `TAVERN_HOMEBREW_TAP_REPO`, or an
explicit local checkout through `TAVERN_HOMEBREW_TAP_DIR`.

Desktop builds compile `assets/mac-icon.icon` with Xcode `actool` before Electron
packaging. The compiled `Assets.car` provides the layered Liquid Glass app icon
on macOS 26, and `AppIcon.icns` remains the fallback icon for older macOS
versions and Electron's DMG/app bundle path.

Grotto releases publish these production artifacts:

* `Grotto.app` (`build.grotto.desktop`) is the desktop client plus its local app backend. Desktop release files use the
  `Grotto_<version>_<arch>` prefix.
* `grotto-server-<version>+git.<short-sha>-aarch64-apple-darwin.tar.gz`
  contains the hosted Server and hosted App. Its sidecar travels with it as a
  GitHub Release asset.
* `computer/<version>/grotto-computer-aarch64-apple-darwin` is the independently
  versioned, signed and notarized Computer executable. Its signed descriptor is
  published immutably beside it before `computer/latest.json` is promoted.
* `grotto-runtime-<version>-<target>.tar.gz` is the always-on Runtime server for
  a Mac mini or other host when the release includes Runtime.

The desktop app connects to the configured Runtime URL. Runtime deployment and
Homebrew service management live in [Runtime Deployment](runtime-deploy.md).

Keep every published changelog version anchored by a matching `vX.Y.Z` git tag
or a `release: vX.Y.Z` commit. The changelog context command uses that anchor to
collect changes for the next release.

## Environment

Required release environment:

* `TAVERN_RELEASE_BASE_URL`
* `TAVERN_RELEASE_S3_URI`
* `VITE_CLERK_PUBLISHABLE_KEY` for the hosted App inside the Server artifact
* `TAVERN_HOMEBREW_TAP_REPO` defaults to `zknicker/homebrew-grotto`
* `TAVERN_HOMEBREW_TAP_DIR` optionally points to a local tap checkout
* `CSC_NAME` or `CSC_LINK` + `CSC_KEY_PASSWORD`
* `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
* `APPLE_PASSWORD` is accepted as a compatibility alias for
  `APPLE_APP_SPECIFIC_PASSWORD`
* `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

Computer releases additionally require
`GROTTO_COMPUTER_RELEASE_PRIVATE_KEY`, the Ed25519 private release key used to
sign the Computer descriptor, and `GROTTO_COMPUTER_RELEASE_PUBLIC_KEY`, its
corresponding trusted public key. The publisher verifies that pair and verifies
the current production descriptor with the public key before building. The
public key is compiled into the Computer executable; normal installation does
not accept a public-key environment override.
`GROTTO_COMPUTER_RELEASE_BASE_URL` defaults to
`https://releases.grotto.sh/computer`; Computer objects publish below the
`computer/` prefix of `TAVERN_RELEASE_S3_URI`. Standalone Computer codesigning
also requires the Developer ID certificate in the macOS keychain, selected by
`CSC_NAME` or `APPLE_SIGNING_IDENTITY`; a `CSC_LINK` file alone is not a
codesign identity.

Runtime releases additionally require `TAVERN_GOOGLE_OAUTH_CLIENT_ID` and
`TAVERN_GOOGLE_OAUTH_CLIENT_SECRET` for the Runtime artifact. App-only releases
do not.

The GitHub Release step uses `gh`; run `gh auth status` before publishing.
