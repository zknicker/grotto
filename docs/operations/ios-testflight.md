---
summary: App Store Connect setup and the durable TestFlight contract for the Grotto iPhone target.
read_when:
  - preparing or promoting a Grotto iOS target
  - signing, archiving, or uploading a Grotto iOS build
  - changing the iOS bundle identifier, entitlements, version, build number, or App Store metadata
---

# iOS TestFlight

Grotto iOS uses bundle identifier `build.grotto.ios`, independent SemVer, and a positive integer
build number that increases for every upload. The checked-in XcodeGen project is canonical. The
shared `assets/mac-icon.icon` Icon Composer source supplies the iPhone and App Store icon.

## One-time Apple setup

Before the first upload, an Account Holder, Admin, or App Manager must:

1. Accept pending App Store Connect agreements.
2. Register the explicit App ID `build.grotto.ios` and enable Associated Domains for
   `webcredentials:clerk.grotto.sh`.
3. Create or verify the **Grotto Chat** app record (Apple ID `6802799165`) with that bundle ID and
   SKU `grotto-ios`.
4. Configure the Apple Developer account or an App Store Connect API key with permission to sign
   and upload builds.
5. Add TestFlight beta details, including feedback contact, sign-in/review instructions, and what
   testers should exercise.
6. Create or verify the **Grotto Internal** TestFlight group and its automatic distribution.

The App Store product page also needs a privacy policy URL and age rating before public App Review.
Internal TestFlight does not require screenshots; a public submission does.

## Version and build identity

The release record is the source of the published iOS marketing version and build number. The
`MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` values baked into `project.yml` are local-build
defaults only. The iOS target job passes the record's explicit values to `xcodebuild`, verifies the
generated project is current, and never uses a CI run number as the build number.

Every upload consumes its build number, including an upload that later fails processing or belongs
to a release that stops. A replacement upload uses a new number and a new append-only release
record or attempt according to the release record contract.

## Target publication and promotion

When `ios` is `publish`, the single `Release` workflow runs the iOS target job after the release PR
merges. The job signs, archives, and uploads the exact version/build pair. `xcodebuild` authenticates
the upload directly, so neither the workflow nor a local publisher needs a TestFlight browser login.
The job does not invite testers or submit the app for public App Review.

After Apple finishes processing:

1. Resolve any build warning or export-compliance prompt. Ordinary HTTPS use is declared
   non-exempt encryption.
2. Add the processed build to **Grotto Internal** and provide **What to Test** notes.
3. Install it through TestFlight on a real iPhone and smoke sign-in, Server discovery, Chat send
   and realtime receive, photo attachment, Thread reply, and foreground recovery.
4. Record the processed build, tester distribution, and device evidence in the release record and
   operator handoff.

TestFlight builds expire after 90 days. Never reuse a build number.

## Credentials

Keep Apple credentials, certificates, provisioning profiles, and App Store Connect `.p8` keys out
of the repository. Use the approved release environment for the target job; a local operator may
be required for account setup or an explicitly manual Apple action. Do not place any credential in
release metadata, changelog text, or the handoff.
