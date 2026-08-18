---
summary: Ownership, dependency, navigation, and rendering boundaries for the native Grotto iPhone app.
read_when:
  - changing the iPhone app, mobile navigation, or native rendering architecture
  - deciding whether mobile behavior belongs in shared logic, native UI, or an artifact web canvas
  - adding a dependency to apps/ios
---

# Grotto for iPhone

`apps/ios` is Grotto's native iPhone client. It is an Expo and React Native application, not a wrapper
around the website. Expo Router owns native routes and HeroUI Native is the approved component system.
Android is not a supported target.

## SwiftUI prototype

`apps/ios-swift` is the active SwiftUI architecture prototype. It does not replace `apps/ios` yet;
the two clients coexist until the native approach has proved the complete daily Chat and settings
loops and the product direction is explicitly chosen. The prototype reuses the same production
Grotto Server, Computer, Clerk instance, and tRPC procedures. It does not add a mobile backend.

The Swift app is split into four focused layers:

- `GrottoModels` owns small Codable projections of the existing first-party wire contracts.
- `GrottoTransport` owns authenticated tRPC HTTP operations, SSE subscriptions, app protocol headers,
  and Clerk session-token access.
- `GrottoUI` owns reusable SwiftUI shell, Chat, thread, and settings presentation with stock semantic
  controls.
- `GrottoApp` composes authentication, Server state, event streams, cache-like snapshots, navigation,
  and presentation adapters.

The transport intentionally calls the existing tRPC procedures directly rather than introducing an
OpenAPI mirror or community Swift tRPC dependency. The prototype uses the official Clerk iOS SDK and
the production-authorized `grotto://sso-callback` OAuth return. Chat history remains canonical Server
state. Agent lifecycle events project `working`, `reading`, and `sending` to the same yellow working
presence used by the React clients; `settled` immediately projects the terminal idle, error, or stopped
state. The app separately subscribes to semantic Agent activity and presents current plus recent work
from the existing `agent.activeActivity`, `agent.onActivity`, and `agent.activityHistory` contracts.

Debug builds mirror the web App's local authentication flow. When launched with
`GROTTO_DEV_SERVER_ORIGIN` and `GROTTO_CLERK_PUBLISHABLE_KEY`, the app requests the existing
localhost-only `dev.createClerkSignInToken` ticket, activates it through Clerk's native SDK, and calls
the idempotent `server.developmentBootstrap` procedure before loading the ordinary Server list. This
avoids a browser dependency in Simulator without adding fixture auth or shipping a development path in
Release builds. A Debug build remembers the last validated localhost configuration so Simulator,
preview, and rebuild launchers that omit process environment still use the same development Clerk
instance and Server. A later explicit environment replaces that local cache.
The Debug authentication boundary validates that a persisted Clerk session can still issue a token
before loading Server-backed UI. If it cannot, the app renews the session through the same localhost
ticket procedure. A configured local build never falls back to browser OAuth.

Swift settings use one native sheet with one `NavigationStack`. Focused screens push within that
sheet, single-line identity values edit inline, and long-form values use a dedicated editor. All
profile values and avatars originate from Server records; the prototype must not create mobile-only
identity state. The Swift prototype also reads Computers through the existing `computer.list`
contract; an unavailable or role-denied Computer snapshot does not block the rest of Settings.
Server-provided relative avatar URLs resolve against the configured Server origin, including local
development; no Swift surface hardcodes the production host or substitutes local seeded artwork.

The Swift prototype deploys to iOS 18 and progressively adopts iOS 26 Liquid Glass for functional
chrome. System navigation and sheet controls inherit the platform treatment; custom menu, search,
and composer controls use native glass only on iOS 26 and retain an opaque semantic fallback on older
systems. Transcript rows, Thread previews, Task metadata, sidebars, and settings groups stay opaque.
Glass is a navigation hierarchy, not a general content-card material.

An anchor message owns one recessed Thread ingress. On iPhone it shows the Server-projected reply and
unread counts plus only the latest recent reply; this is a presentation reduction of the same Thread
summary used by the desktop App. A Task uses that same ingress with its number, status disc, and
assignee, including before its first reply. The anchor message remains the task title and is never
duplicated inside the ingress.

Swift optimistic Chat and Thread rows remain app-local and keyed by the client nonce. Thread replies
use the canonical parent Chat plus anchor-message contract. A failed mutation removes its optimistic
row and restores the exact draft, while a successful row remains pending until a refreshed Server
page contains the matching nonce. On returning to the foreground, the app keeps cached presentation
visible, refetches its active Server snapshots and already-open message pages, then restarts live Chat
and Agent lifecycle streams. Chat and Thread timelines page older history through the existing
`beforeSequence` cursor, merge overlapping pages by message id in Server sequence order, and preserve
the prior top row as the scroll anchor. The Swift prototype keeps one in-memory cursor per active
Server, walks `chat.events` from that cursor on reconnect, and refetches loaded affected Chat pages.
The SSE connection is established before recovery, while buffered live events are consumed only after
the walk completes, so events arriving during recovery are not missed. A cold start seeds the cursor
from `chat.eventHead` after refreshing the Server snapshot;
cursor state is intentionally process-memory only for this prototype.

Utility navigation stays on the same Server contracts and Store cache. The header search sheet calls
`chat.search` across the active Server and resolves each result against the canonical chat directory;
the sidebar search remains a local chat-name filter. Archived channels load through
`chat.listArchived` and restore through `chat.unarchiveChannel`, while channel creation uses the live
Agent directory and `chat.createChannel`. These sheets receive narrow async closures from `GrottoApp`
so `GrottoUI` remains independent of tRPC and does not invent mobile-only ids or records.

Swift Chat and Thread composers use the system inline Photos picker and Files importer plus a focused
AVFoundation camera surface on physical iPhones. Photos and Camera expand from the composer into one
rounded, local attachment portal above the keyboard; they do not create routes or full-screen covers.
That portal returns along the same bottom-leading path into the attachment preview area so source,
selection, and staged result remain spatially continuous. Selected files stay in a composer-owned temporary directory
until the message succeeds, and imported security-scoped URLs are copied while access is active rather
than retained or buffered into memory. Sending reserves each file
through the existing `attachment.reserve` procedure, uploads bytes through the authenticated raw
attachment route, then associates the returned attachment ids through `chat.send`; no native-only
attachment record exists. Pending rows show the selected files while upload is unresolved, failures
restore the exact text and files for retry, and successful Server attachments render identically in
main timelines and Thread replies. Opening an attachment downloads it to a temporary file and presents
the native Quick Look surface. The client enforces the Server's 50 MiB limit before reservation.

## Ownership

Grotto Server remains the canonical owner of collaboration state. Grotto Computer does not know whether
a request came from desktop or iPhone. The iPhone app owns only presentation state, settings, optimistic
UI, and its React Query cache. When connectivity is lost, persistent UI renders only server data already
present in that cache.

Shared API contracts, query options, view models, and capability hooks should live in platform-neutral
packages or modules. React DOM and React Native rendering diverge at their component boundary; shared
hooks must not return DOM or native elements.

`@tavern/app-client` owns the shared typed tRPC client, authenticated HTTP and WebSocket transports,
React Query policy, durable Chat event catch-up primitives, Agent lifecycle cache projection, and
focused Server, Chat, message, Agent, and member hooks. Each product surface owns its platform
lifecycle: the iPhone app reconnects after foregrounding and mounts one durable Chat event cursor plus
one volatile Agent lifecycle listener per active Server. Lifecycle events project every active phase to
`Agent.availability = working`; only the terminal `settled` event clears it. Reconnect refetches the
durable Agent list, whose active-run state restores the same availability. Native feature leaves call
the focused hooks and project platform view models instead of receiving one screen-wide fetched graph.

The native Chat timeline uses cursor-based infinite queries. Durable event listeners invalidate the
exact active Chat cache, while reconnect catch-up replays missed Server events before live delivery
continues. Optimistic sends remain app-local and are keyed by the client nonce. A pending row retires
only after the canonical Server message arrives; a failed send restores its content to the composer for
an explicit retry. Optimistic rows never patch durable history.

The open native Chat and Thread surfaces acknowledge the latest loaded message sequence through
`chat.markRead`. Identical Server/Chat/sequence acknowledgements are deduplicated in memory, and a
successful receipt refreshes `chat.list` so unread counts remain Server projections rather than local
durable state.

Native Thread routes are anchored by the parent message id, which exists before the child Chat is
created. The route also carries the parent Chat id and may carry a resolved Thread Chat id. Opening an
unthreaded message therefore needs no speculative Server write: the first reply sends the parent Chat
id plus the anchor message id, adopts the returned child Chat id, and continues on the same screen.
Thread optimistic rows stay keyed by the anchor across that transition. Existing Threads reuse the
same route and shared timeline presentation with their child Chat id already resolved. If another
client creates the Thread while that route is open, the refreshed parent summary supplies the child
Chat id and the native screen adopts it without remounting. Back navigation carries the parent Chat id
explicitly so app reloads cannot return to a default Chat, while ordinary stack navigation preserves
the mounted parent timeline and scroll position. Task metadata renders on its canonical anchor message;
the native timeline does not invent a second task receipt row.

Clerk owns native authentication. The production instance uses Google as its only sign-in strategy, so
Grotto starts Clerk's direct Google SSO flow from a native HeroUI action instead of routing through the
hosted Account Portal. The provider browser returns through the production-authorized
`grotto://sso-callback` product URL. Grotto intentionally excludes Clerk's native UI/client bridge from
Expo autolinking; the JavaScript SSO flow does not use that second native session owner. `ClerkProvider`
persists its JS session through Expo
SecureStore, while the authenticated Grotto provider reads a fresh Clerk token for every request and
keys the QueryClient to the active user id. A user change therefore discards the previous user's
in-memory Server cache.
React Query keeps successful Server snapshots visible through background transport failures. The native
cache is currently process-memory only; cold-start offline access needs an explicit secure auth bootstrap
contract before persisted query data can be enabled safely.

## Rendering boundary

The app shell, navigation, chat timeline, composer, threads, settings, and artifact controls are native.
An interactive artifact may use an isolated web canvas inside its native route when the artifact runtime
requires browser APIs. That canvas receives a narrow serialized contract and does not own authentication,
navigation, server queries, or durable app state.

## Native shell

`AppShell` owns the persistent chat drawer and its gesture state, and projects the selected Chat from
the current route. `AppLayout` owns the shared screen geometry: safe-area handling, keyboard avoidance,
header, content, and footer slots. Screens compose those static slots directly; the layout has no data
context or route knowledge. Expo Router owns Chat selection so navigation and restoration do not depend
on a mounted component's local state. Drawer openness and gesture progress remain volatile shell state.

Native settings live in one shell-owned HeroUI BottomSheet. A small sheet-local stack owns volatile
push/pop history and animates between the Settings hub, human and Agent profiles, and focused editors;
those destinations do not create nested sheets or Expo routes. Closing Settings resets that local
history. The sheet's scroll viewport reaches the device bottom; each scrollable screen or fixed editor
owns its safe-area content inset so the home indicator does not become a blank footer outside scrolling.
The hub reads lightweight Server, Agent, and member lists, while human and Agent profiles read
focused detail snapshots at their screen leaves. Their existing Server-backed identity and avatar
mutations live in focused shared App-client hooks and refresh the matching detail plus directory caches.
Native image selection center-crops and downsizes to the shared avatar contract before upload; the
iPhone app never stores a second identity record. Settings compose stock HeroUI Native grouped lists
and controls. Profile pages keep short identity values such as names editable inline and push long-form
values such as descriptions into a focused editor within the same Settings sheet.
The mobile settings subset includes human and Agent profiles, read-only Server identity, Tasks,
People, Computers, Appearance, and app information. Tasks is a lens over Server-owned promoted
messages and opens the existing canonical Task Thread route; it is not a second task store.
Appearance is app-local presentation state: the iPhone
client persists its `system`, `light`, or `dark` preference in Expo SecureStore and applies it through
Uniwind. It never creates or updates Server state.
Desktop-only operational surfaces such as model inventory, Skills, MCP connections,
Browser supervision, and destructive administration stay out of the iPhone information architecture
until a concrete mobile workflow needs them.

`apps/ios/src/components` owns reusable native presentation composed on top of HeroUI Native. These
components expose explicit compound slots and stable interaction behavior; feature code keeps its
drafts, mutations, validation, and product copy at the assembly site. `SettingsField`,
`SettingsDisclosureRow`, `SettingsListGroup`, and `SettingsSection` own the shared label inset, HeroUI
separators, typography, inline controls, and labeled ingress rows. `SheetStack` owns the reusable
sideways screen transition
and `TextEditorScreen` owns the
borderless multiline input, HeroUI bottom-sheet keyboard handlers, delayed focus, and confirmation
control. A Profile or future settings feature composes its title, error, and save mutation at the
assembly site. Do not clone that behavior inside feature folders or add product-mode boolean props to
shared components.

`apps/ios/src/global.css` owns iPhone-only HeroUI semantic theme overrides. The light theme uses a
cool iOS grouped-background palette with white, shadow-free persistent surfaces and fields;
overlays retain their shadow so sheets and dialogs still communicate depth. Keep palette and elevation
changes at this token boundary rather than restyling individual HeroUI components. These native tokens
do not affect the website or Electron app theme.

## Dependencies

HeroUI Native is the only general UI component library. Discuss and approve any additional UI library
before adding it. Native infrastructure dependencies required by Expo, Expo Router, or HeroUI Native are
allowed when they implement platform capability rather than a second visual system.

HugeIcons Pro Rounded is the approved native icon family. Use Solid Rounded for primary content and
action icons. Use Stroke Rounded for settings value rows and small disclosure arrows, where the lighter
visual weight suits dense secondary information.
`AppIcon` bridges both sets to HeroUI semantic colors so icons and their surrounding HeroUI controls share
one theme-aware foreground. Import individual icons so Metro can tree-shake unused assets.

The generated `apps/ios/ios` directory is ignored. After app configuration or native dependency changes,
regenerate it with `bunx expo prebuild --platform ios --clean` and prove the result in an iPhone Simulator.
