---
summary: Ownership, dependency, navigation, and rendering boundaries for the native Grotto iPhone app.
read_when:
  - changing the iPhone app, mobile navigation, or native rendering architecture
  - deciding whether mobile behavior belongs in shared logic, native UI, or an artifact web canvas
  - adding a dependency to apps/ios-swift
---

# Grotto for iPhone

`apps/ios-swift` is Grotto's native iPhone client. It is a SwiftUI application, not a wrapper around
the website. Android is not a supported target. The app reuses the same production Grotto Server,
Computer, Clerk instance, and tRPC procedures; it does not add a mobile backend.

## Architecture

The app is split into four focused layers:

- `GrottoModels` owns small Codable projections of the existing first-party wire contracts.
- `GrottoTransport` owns authenticated tRPC HTTP operations, SSE subscriptions, app protocol headers,
  and Clerk session-token access.
- `GrottoUI` owns reusable SwiftUI shell, Chat, thread, and settings presentation with stock semantic
  controls.
- `GrottoApp` composes authentication, Server state, event streams, cache-like snapshots, navigation,
  and presentation adapters.

The transport intentionally calls the existing tRPC procedures directly rather than introducing an
OpenAPI mirror or community Swift tRPC dependency. The app uses the official Clerk iOS SDK and
the production-authorized `grotto://sso-callback` OAuth return. Chat history remains canonical Server
state. Agent lifecycle events project `working`, `reading`, and `sending` to the same yellow working
presence used by the desktop App; `settled` immediately projects the terminal idle, error, or stopped
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
profile values and avatars originate from Server records; the app must not create mobile-only identity
state. The app also reads Computers through the existing `computer.list`
contract; an unavailable or role-denied Computer snapshot does not block the rest of Settings.
Server-provided relative avatar URLs resolve against the configured Server origin, including local
development; no Swift surface hardcodes the production host or substitutes local seeded artwork.

Channel appearance is Server state the iPhone app only renders. A channel's `icon` and `color` reach
`ChatSummary` unchanged, and `ChannelIconBox` draws the chosen glyph in its tinted box everywhere a
channel glyph appears: the sidebar, the chat header, the chat details hero, chat search results, and
the archived list. There is no appearance editor on iPhone. The color presets live in
`ChannelColorPalette` and mirror the App's `channel-color-options.ts`, which stays the source of
truth; a channel stores the preset id, so an unknown id renders the muted default rather than an
invented tint. The glyph geometry is a bundled JSON resource,
`Sources/GrottoUI/Resources/channel-icons.json`, regenerated with
`bun apps/ios-swift/scripts/generate-channel-icon-paths.ts`. That script reads the icon *names* back
out of the App's generated catalog rather than re-curating, so the two clients cannot drift apart;
it converts hugeicons' SVG elements into path data, and `SVGPathData` parses that into a SwiftUI
`Path` normalized from the 24x24 viewBox. `ChannelIconCatalog` decodes the resource once off the
main actor and caches each glyph's parsed `Path` on first use. Until it lands — and for any name the
catalog does not carry — the box renders the hash, so the glyph never changes size or position.

Sent image attachments render inline as media tiles rather than file rows: the timeline downloads
through the same authenticated attachment route Quick Look uses, decodes a downsampled ImageIO
thumbnail sized for the tile, and keeps the result in an in-memory `AttachmentImageCache` keyed by
attachment id so scrolling and re-renders don't re-download or re-decode. Non-image attachments and
still-uploading pending rows keep the existing file row.

The app deploys to iOS 18 and progressively adopts iOS 26 Liquid Glass for functional
chrome. System navigation and sheet controls inherit the platform treatment; custom menu, search,
and composer controls use native glass only on iOS 26 and retain an opaque semantic fallback on older
systems. Transcript rows, Thread previews, Task metadata, sidebars, and settings groups stay opaque.
Glass is a navigation hierarchy, not a general content-card material.

Every floating chrome control is one control. `GlassChromeButton` owns the 44-point circle, the
19-point medium glyph, and the glass or material treatment, and `ChromeHeader` owns the 56-point
chrome row that positions leading, centered, and trailing chrome. Call sites choose a glyph and a
label; they do not restyle the control or set their own geometry. The sidebar and the Chat canvas
both open with that same row, so a chrome button in either pane lands on one centerline. A fixed-size chrome circle must not
be placed in a system navigation bar, which compresses it into an ellipse: a screen that wants the
chrome circle supplies its own `ChromeHeader` and hides the navigation bar, as the Settings sheet
root does. Pushed screens keep the standard navigation bar with its system back button and text
actions.

Dismiss controls follow one vocabulary. A form that creates or edits a draft uses Cancel plus a
confirming verb (Create, Save); an informational sheet with nothing to confirm uses Done; the
Settings sheet root uses its glass X because it owns a `ChromeHeader` instead of a navigation bar;
and a pushed screen uses the system back chevron rather than an explicit control.

Dark mode cannot use the canvas shadow to separate an open drawer from the sidebar, because a black
canvas over a black sidebar has no edge. The veil painted over the slid-aside canvas therefore
reverses by scheme: light mode fades the canvas toward the background and reads its edge from the
shadow, while dark mode lifts the canvas to an elevated surface so the sidebar stays the recessed
plane. `GrottoDrawerVeil` owns that rule.

The sidebar drawer tracks the finger. A horizontal drag anywhere on the Chat canvas attaches the
canvas to the finger, moves it one to one inside its travel, and stops at both ends because nothing
sits behind the canvas past either edge; `DrawerInteraction` owns that math and its release decision,
so a flick settles the drawer by velocity and a slow drag settles it by position. The drag uses a UIKit pan recognizer so it can claim
only horizontal movement, cancel an in-flight vertical timeline scroll once it begins, and leave
horizontally scrollable content such as staged attachments alone. There is no edge-only hit zone and
no all-or-nothing open.

An anchor message owns one recessed Thread ingress. On iPhone it shows the Server-projected reply and
unread counts plus only the latest recent reply; this is a presentation reduction of the same Thread
summary used by the desktop App. A Task uses that same ingress with its number, status disc, and
assignee, including before its first reply. The anchor message remains the task title and is never
duplicated inside the ingress.

Tasks are Server work, not a settings screen. The sidebar opens the Task list as a push on the root
navigation stack, and opening a Task row pushes its Thread on top of that list, so Back walks Thread
→ Task list → Chat canvas. Opening a Task selects the Task's parent Chat and pushes the Thread
together in one move; splitting those writes would return the popped stack to whichever Chat was
selected before. A pushed Thread owns the open Chat while it is on screen, and the shell's Chat
selection resumes ownership when it pops.

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

Utility navigation stays on the same Server contracts and Store cache. One search surface serves the
active Server, reachable from the Chat header and from the sidebar's own chrome button. Like the
desktop command menu, it unifies in the UI rather than in the API: chats match locally against the
Store's chat directory and appear immediately, while messages resolve through `chat.search` behind a
debounce and each result is resolved against the canonical chat directory. A Server search failure
degrades the message section alone and leaves chat matches usable. Selecting a message result selects
its Chat, scrolls the loaded page to that message, and highlights it briefly; a result whose Chat has
left the directory reports a failure alert in the sheet instead of dismissing into an unrelated Chat,
and a message outside the loaded pages is not chased with a speculative fetch. Archived channels load
through `chat.listArchived` and restore through `chat.unarchiveChannel`, and a successful restore
dismisses the sheet and selects the restored channel through the same pending-selection wait a newly
created channel uses, because both reappear only on the next Server chat list. Channel creation uses
the live Agent directory and `chat.createChannel`. These sheets receive narrow async closures from
`GrottoApp` so `GrottoUI` remains independent of tRPC and does not invent mobile-only ids or records.

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
UI, and its in-memory Store cache. When connectivity is lost, persistent UI renders only server data
already present in that cache.

Shared wire contracts and model projections belong in `GrottoModels`; authenticated operations,
realtime delivery, and recovery belong in `GrottoTransport`. `GrottoUI` receives narrow models and
closures from `GrottoApp` rather than owning Server transport or inventing mobile-only records.

The Chat timeline uses cursor-based pages. Reconnect catch-up walks missed Server events before live
delivery continues, and loaded affected Chat pages are refetched in sequence order. Optimistic sends
remain app-local and are keyed by the client nonce. A pending row retires only after the canonical
Server message arrives; a failed send restores its content to the composer for an explicit retry.
Optimistic rows never patch durable history.

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
Grotto starts Clerk's direct Google SSO flow from a native SwiftUI action instead of routing through the
hosted Account Portal. The provider browser returns through the production-authorized
`grotto://sso-callback` product URL. `GrottoTransport` asks the native Clerk session for a fresh token
for every request, while `GrottoStore` keeps the active user's in-memory Server snapshots. A user
change therefore discards the previous user's cache. Cold-start offline access needs an explicit secure
auth bootstrap contract before persisted query data can be enabled safely.

## Native surface

The app shell, navigation, chat timeline, composer, and threads are native SwiftUI. An interactive
artifact may use an isolated web canvas inside a native route when the artifact runtime requires
browser APIs; that canvas would receive a narrow serialized contract and would not own authentication,
navigation, Server queries, or durable app state. No artifact route is wired into the current app —
this remains future work.

Settings stay inside one native sheet and `NavigationStack`. Settings is entered from the sidebar's
floating gear control, pinned bottom-trailing over the scrolling chat list; the sidebar's Server
header is a plain, non-interactive title. Chat details for an Agent opens the same sheet already
pushed to that Agent's profile. A deep link seeds the sheet's navigation path, so the hub stays behind the
pushed screen and the system back button returns to it. The Chat details sheet and the Settings sheet
are mutually exclusive: details dismisses first and Settings presents from its dismissal. The Settings
hub reads lightweight Server, Agent, member, and Computer projections; profile screens own focused
identity mutations; and long-form values use dedicated editors. Appearance is app-local presentation state and never creates or updates
Server state. Desktop-only operational surfaces remain out of the iPhone information architecture until
a concrete mobile workflow needs them.

The Swift client uses Apple platform frameworks for photos, camera, files, and Quick Look, plus the
official Clerk iOS SDK. It does not carry a second web or JavaScript UI system.
