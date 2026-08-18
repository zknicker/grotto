---
summary: One-time App Store Connect setup and recurring TestFlight publication for the Grotto iPhone app.
read_when:
  - preparing the first Grotto iOS or TestFlight release
  - signing, archiving, uploading, or promoting a Grotto iOS build
  - changing the iOS bundle identifier, entitlements, version, build number, or App Store metadata
---

# iOS TestFlight

Grotto iOS uses bundle identifier `build.grotto.ios`, independent SemVer, and an integer build
number that increases for every upload. The checked-in XcodeGen project is canonical. The shared
`assets/mac-icon.icon` Icon Composer source supplies the iPhone and App Store icon.

## One-Time Apple Setup

An Account Holder, Admin, or App Manager completes the account work before the first upload:

1. Accept any pending agreements in App Store Connect.
2. In Certificates, Identifiers & Profiles, register the explicit App ID `build.grotto.ios` and
   enable Associated Domains for `webcredentials:clerk.grotto.sh`.
3. In App Store Connect, create an iOS app named **Grotto** with that bundle ID. Use a stable
   internal SKU such as `grotto-ios`.
4. Add the Apple Developer account in Xcode, or create an App Store Connect API key with permission
   to manage and upload builds. Automatic signing creates or downloads the App Store distribution
   certificate and provisioning profile.
5. Add TestFlight beta details: description, feedback email, contact information, sign-in/review
   instructions, and what testers should exercise.
6. Create an internal TestFlight group. External testing comes later; its first build requires
   TestFlight App Review.

The App Store product page also requires a privacy policy URL and age rating before public App
Review. Screenshots are not required for an internal TestFlight upload, but the eventual App Store
submission needs at least one accepted iPhone screenshot.

## Local Credentials

Interactive uploads can use the Apple account stored in Xcode. Set the team explicitly so the
publisher never guesses between memberships:

```sh
export IOS_DEVELOPMENT_TEAM=<Apple-Team-ID>
```

For unattended signing and upload, set all three App Store Connect API key values:

```sh
export APPLE_API_KEY_PATH=/absolute/path/to/AuthKey_<key-id>.p8
export APPLE_API_KEY_ID=<key-id>
export APPLE_API_ISSUER=<issuer-id>
```

Keep the `.p8` key outside the repository. Never commit Apple credentials, certificates, or
provisioning profiles.

## Publish A Build

Record the independent version and next unused build number in `release-surfaces.json`, then run:

```sh
bun run ios:release 1.0.0 --build-number 1 --dry-run
bun run ios:release 1.0.0 --build-number 1
```

The dry run verifies that `Grotto.xcodeproj` matches `project.yml` and performs an unsigned Release
build. The publication command archives with automatic signing and uploads through App Store
Connect. It does not invite testers or submit the app for public App Review.

After Apple finishes processing:

1. Resolve any build warning or export-compliance prompt. The app declares that its ordinary HTTPS
   use does not contain non-exempt encryption.
2. Add the build to the internal group and provide **What to Test** notes.
3. Install through TestFlight on a real iPhone and smoke sign-in, Server discovery, Chat send and
   realtime receive, photo attachment, Thread reply, and foreground recovery.
4. Record the processed build and real-device evidence in the coordinated release handoff.

TestFlight builds expire after 90 days. Never upload a second binary with a reused build number;
increment it even when the marketing version is unchanged.
