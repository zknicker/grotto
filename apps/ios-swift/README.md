# Grotto iPhone — SwiftUI prototype

This directory is the native SwiftUI prototype for the iPhone client. It keeps
the existing Grotto Server, Computer, Clerk instance, and tRPC API intact. It
does not introduce a mobile backend.

The prototype currently proves production Google sign-in, Server discovery,
channels and Agent DMs, real message history, live Chat event refresh, Agent
lifecycle presence, optimistic Chat and Thread sends with draft recovery,
cursor-based older-history loading, foreground snapshot recovery, Server-backed
People and Computers, the native sidebar and composer, and one sheet-local
settings navigation stack backed by Server profile data.

The package targets iOS 18 and uses Swift 6. The XcodeGen app specification
adds the official Clerk iOS package at the exact, reviewed `1.2.0` release and
links only `ClerkKit` into the application target. It intentionally does not
add an OpenAPI generator or a community tRPC client. `GrottoTransport` sends
the existing app protocol headers and performs typed tRPC HTTP operations and
SSE subscriptions directly.

## Run in Simulator

A Debug build signs in automatically against a local Grotto Server, so Simulator
needs no browser OAuth. See
[Grotto For iPhone In Simulator](../../docs/operations/development.md#grotto-for-iphone-in-simulator)
for the stack, build, install, and launch commands. Release builds always use the
production Server and its Google sign-in.

## Local checks

Run the complete package test suite from this directory:

```bash
swift test
```

`GrottoJSON.decoder()` and `GrottoJSON.encoder()` are the production coding
factories. Grotto timestamps are ISO-8601 strings with an explicit offset and
optional fractional seconds; the custom strategy accepts both forms and emits
UTC timestamps with fractional seconds.

Generate the app project with:

```bash
xcodegen generate --spec project.yml
```

## Generated resources

`Sources/GrottoUI/Resources/channel-icons.json` carries the channel icon
geometry and `ui-icons.json` carries the app icon set. Regenerate them after the
App's icon catalog changes, or after adding a `GrottoIconName` case:

```bash
bun apps/ios-swift/scripts/generate-channel-icon-paths.ts
```

```bash
bun apps/ios-swift/scripts/generate-ui-icon-paths.ts
```

Both share the converter in `scripts/hugeicon-paths.ts` and differ only in which
hugeicons family and which names they ask for. The channel script reads its
names from `apps/website/src/components/chats/channel-icon-catalog.generated.ts`
and the app icon script reads the names the App's own source imports plus the
raw values of `GrottoIconName`, so the curation lives in one place and the two
clients cannot offer different icons. The app icon script fails if a name
`GrottoIconName` asks for is not in the stroke-rounded family.

The application target under `Sources/GrottoApp` consumes the local
`GrottoModels`, `GrottoTransport`, and `GrottoUI` products. SwiftUI previews can
use `GrottoPreviewFixtures` and `SettingsFixtures` without a Server or Clerk
session.
