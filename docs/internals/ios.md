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
state. On startup, iOS reports the signed-in Clerk name and email through `member.syncIdentity` before
loading the Server snapshot, matching the web app's default-handle bootstrap. A human edits their
Server-scoped handle alongside their display name. Native validation mirrors
the shared handle grammar for immediate feedback, while `member.updateProfile` carries the active
`serverId` and Server remains authoritative for cross-human/Agent uniqueness. The app also reads
Computers through the existing `computer.list`
contract; an unavailable or role-denied Computer snapshot does not block the rest of Settings.
Server-provided relative avatar URLs resolve against the configured Server origin, including local
development; no Swift surface hardcodes the production host or substitutes local seeded artwork.
An ordinary Agent's profile may call the same Server-owned `avatar.generate` procedure as the desktop
App with one short concept, from a capsule directly under the avatar it changes. A factory Agent does
not offer it: the Server refuses to replace Cove's product-owned artwork, so `SettingsAgent` carries
`canGenerateAvatar` from the Agent's `factoryKind` and the App and the phone gate the entry the same
way. Swift keeps the returned image only in the generation sheet until the human taps Save, which
applies it through the ordinary `avatar.set` contract; dismissal discards the preview, and the
existing native photo picker remains the manual-upload path.

The generation sheet leads with the preview at the size and circular shape the product actually draws
an avatar, so what the human approves is what every surface will show. It is an ordinary scrolling
sheet: Cancel and Save are the navigation bar's own actions, Generate is one button inline under the
concept field, and the keyboard toolbar carries Done because a vertical-axis field spends Return on a
newline. Nothing is pinned above the keyboard, so raising it never buries a control. Concept
suggestions live inside the concept card and appear only while the field is empty, so the layout below
the card never shifts, and the only prose under the preview is the wait itself — the screen does not
narrate controls that are already on it. Drawing one avatar takes the image provider tens of seconds: the operation carries its
own request timeout well past `URLSession`'s 60-second default, the wait is marked on the preview
itself, and Cancel stays live for the whole generation — only the save that writes the avatar holds
the sheet open. No Server failure reaches a human as a tRPC string; `AvatarGenerationFailure` maps each
documented outcome — unconfigured provider, capacity, authorization, missing owner, provider failure,
unreachable Server — onto one sentence that says what to do next.

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

Image attachments render inline as media tiles rather than file rows: the timeline downloads
through the same authenticated attachment route Quick Look uses, decodes a downsampled ImageIO
thumbnail off the main actor, and keeps the result in an in-memory `AttachmentImageCache` keyed by
attachment id so scrolling and re-renders don't re-download or re-decode; `body` reads the cache
synchronously so a recycled tile renders fully formed on its first frame. Tiles are fixed-height
(`AttachmentImageTileSize.tileHeight`) with aspect-tracking width, so a landing decode never changes
a row's height. Pending uploads render through the same tile from their staged local file — decoded
once into `LocalAttachmentImageCache`, which also serves the composer strip and the attachment
morph — and the retired pending row's replacement adopts the identical bitmap by filename and byte
size, so a send never reflows. Non-image attachments keep the file row.

The app deploys to iOS 18 and progressively adopts iOS 26 Liquid Glass for functional
chrome. System navigation and sheet controls inherit the platform treatment; custom menu, search,
and composer controls use native glass only on iOS 26 and retain an opaque semantic fallback on older
systems. Transcript rows, Thread previews, Task metadata, sidebars, and settings groups stay opaque.
Glass is a navigation hierarchy, not a general content-card material.

Every floating chrome control is one control. `GlassChromeButton` owns the 44-point circle, the
22-point app icon, and the glass or material treatment, and `ChromeHeader` owns the 56-point
chrome row that positions leading, centered, and trailing chrome. Call sites choose a glyph and a
label; they do not restyle the control or set their own geometry. The sidebar and the Chat canvas
both open with that same row, so a chrome button in either pane lands on one centerline. A
fixed-size chrome circle must not be placed in a system navigation bar, which compresses it into an
ellipse: a screen that wants the chrome circle supplies its own `ChromeHeader` and hides the
navigation bar, as the Chat shell root does. Pushed screens keep the standard navigation bar with
its system back button and text actions.

One navigation stack answers to one bar decision, and inside a sheet that is not a preference. A
stack whose root hides the bar and whose pushed screens show it lays the incoming screen out against
the pre-push top safe area: the pushed bar and its content drew a grabber-height too high for the
whole transition, then dropped into place a frame after it ended. The Chat shell survives the same
toggle only because a full-screen root's top inset does not change when the bar appears. A sheet's
stack therefore keeps the system bar on every screen, root included — the Settings root carries an
inline "Settings" title with a trailing close button, which lands on the same rail and centerline as
the back chevron of every screen it pushes.

App iconography is hugeicons stroke-rounded, the same family the App's React surfaces import, so the
two clients draw one vocabulary. It renders through the machinery the channel glyphs already used:
`hugeicon-paths.ts` converts a family's SVG elements to path data, `GrottoIcon` draws a name at a
point size, and `HugeiconGlyph` strokes or fills the normalized unit square. The two resources differ
only in family and in which names they ask for. `generate-ui-icon-paths.ts` reads the names the App
imports *and* the raw values of `GrottoIconName`, and fails if a name the phone asks for is not in
the family — without that check a typo renders an invisible icon. `ui-icons.json` is small enough to
decode on first use, unlike the 1.8 MiB channel catalog, so an icon never appears after its row has
drawn.

SF Symbols stay wherever the system owns the grammar: inside `ContentUnavailableView`, `Menu` labels,
and `Label`, and for navigation backs, disclosure chevrons, picker chevrons, and selection
checkmarks. Those read as platform affordances rather than product iconography, and a custom glyph
among a system menu's own rows looks foreign. Two things an SF Symbol does for free that a path does
not: track the text baseline, and scale with Dynamic Type. `GrottoIcon` does neither, so every caller
hands it a box, and that box is what aligns it beside text.

A hugeicons name describes a shape, not a concept, and does not map onto an SF Symbol name — the
family numbers its arrows by form, so `ArrowUp01Icon` is a bare chevron and only `ArrowUp02Icon`
carries a shaft. Match a replacement by looking at it. The family also draws at a 1.5 stroke on its
24pt grid, which reads thinner than the medium-weight symbols it replaced, so call sites pass a
heavier weight; that weight is the knob to reach for when an icon looks faint.

On iOS 26 that circle is the system glass button style, which owns the press treatment end to end.
The control draws no rim or shadow of its own there: a hand-drawn edge does not travel with the
glass as it answers a touch, so a press left the stroke stranded inside the pressed shape and the
shadow pinned to the resting size. The style also owns its padding, so the label is inset by that
amount to land the drawn circle back on the shared diameter. The pre-26 fallback is
`.regularMaterial`, which has neither an edge nor a lift of its own, and still draws both.

A chrome button's shadow spills past the edges of whatever contains it. The sidebar is composited
with `.mask()`, which rasterizes into a buffer sized to the sidebar's own resolved height, so that
spill survives only inside real layout height: `ChatSidebarView` reserves `shadowBleedHeight` of
inert space at both ends and `GrottoShellView` grows and re-anchors the proposed height to match.
Without the leading reservation the search button's shadow ended at a hard line on the sidebar's
top edge.

Dismiss controls follow one vocabulary. A form that creates or edits a draft uses Cancel plus a
confirming verb (Create, Save); an informational sheet with nothing to confirm uses Done; the
Settings sheet root uses an X in its navigation bar, which the system draws as the same glass circle
it gives the back chevron; and a pushed screen uses the system back chevron rather than an explicit
control.

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
no all-or-nothing open. Selecting a Chat is the only action that closes the drawer; every sidebar
entry point that presents another surface — Search, Tasks, Settings, Archived, New channel — leaves
the drawer open behind it, so dismissing returns to the open drawer and no presentation ever runs
against the closing spring.

The Chat canvas is keyed by the selected destination: a Chat switch remounts the screen, so each
Chat lays out bottom-anchored and fully formed before the drawer reveals it, and no scroll offset or
screen-local state crosses between Chats. Anything that must survive a switch — the composer draft,
the staged attachments and their in-flight preparation, a pending message reveal — is owned by the
shell per destination and reaches the screen as a binding or by reference; a remount resets only
presentation state (an open portal, a frozen keyboard inset, an error notice). A page arriving for a Chat that was showing nothing is that Chat's first paint and settles
at the bottom without animation; only genuine appends animate.

Both transcripts — the Chat timeline and a Thread's replies — hold the bottom as a scroll *edge*,
through `ScrollPosition(edge: .bottom)`, and never as an offset onto the last row. An offset has to
resolve against a container height, and a Chat's first paint asks for one before the canvas has that
height, which parked the transcript a full screen past its own content until the reader dragged it
back. An edge stays pinned while the page lands and the rows settle, and stops following the moment
the reader scrolls away from it. `defaultScrollAnchor(.bottom)` remains alongside it for the other
job it does: aligning a transcript shorter than the screen onto the composer instead of the header.

An anchor message owns one recessed Thread ingress. On iPhone it shows the Server-projected reply and
unread counts plus only the latest recent reply; this is a presentation reduction of the same Thread
summary used by the desktop App. A Task uses that same ingress with its number, status disc, and
assignee, including before its first reply. The anchor message remains the task title and is never
duplicated inside the ingress.

Tasks are Server work, not a settings screen. The sidebar opens the Task list as a push on the root
navigation stack, and opening a Task row pushes its Thread on top of that list, so Back walks Thread
→ Task list → Chat canvas. Opening a Task leaves the canvas selection alone — its route carries the
parent Chat id and the Task carries the child Chat id, so selecting the parent would mark a channel
the user never visited as read and strand them there once the Tasks list pops. A pushed Thread owns
the open Chat while it is on screen, and the shell's Chat selection resumes ownership when it pops;
the covered canvas Chat stays named so its page keeps refreshing underneath, but read
acknowledgements belong to the deepest surface alone.

Swift optimistic Chat and Thread rows remain app-local and keyed by the client nonce. Thread replies
use the canonical parent Chat plus anchor-message contract. A failed mutation removes its optimistic
row and restores the exact draft, while a successful row remains pending until a refreshed Server
page contains the matching nonce. On returning to the foreground, the app keeps cached presentation
visible, refetches its Server snapshot in one gathered pass — applied as a single repaint, with
every Chat surface on the stack refetched eagerly: the deepest open Chat first, then the canvas Chat
underneath it, so popping a Thread reveals a parent that is already fresh instead of one round trip
stale; the event walk and `openChat` cover the rest — then restarts live Chat and Agent lifecycle
streams. A voluntary refresh keeps the connected state;
offline is what a failed refresh or a broken stream reports. Live SSE Chat events coalesce for a
short window (`ChatEventCoalescer`) before the existing batch applier runs, so a burst lands as one
refetch fan-out rather than one per frame.

The Chat projections the shell renders every frame — message rows and the destination list — are
memoized in the Store behind a structural invalidation contract: their input fields are stored
privately in `GrottoStore` and published through accessors whose setters drop equal-value writes and
retire exactly the cached projections that field feeds. A new field a projection reads must join
that "Projected Server state" block, and a projection must read its observable inputs before its
cache check so a cached answer leaves the calling view subscribed to exactly what a rebuilt one
would. Optimistic rows adopt the canonical Server message id from the send receipt, so a pending
row's presentation id is a real Server id from that moment and its ForEach identity never changes
when the durable row arrives. Chat and Thread timelines page older history through the existing
`beforeSequence` cursor, merge overlapping pages by message id in Server sequence order, and preserve
the prior top row as the scroll anchor. The Swift prototype keeps one in-memory cursor per active
Server, walks `chat.events` from that cursor on reconnect, and refetches loaded affected Chat pages.
The SSE connection is established before recovery, while buffered live events are consumed only after
the walk completes, so events arriving during recovery are not missed. A cold start seeds the cursor
from `chat.eventHead` after refreshing the Server snapshot;
cursor state is intentionally process-memory only for this prototype.

Prepared actions stay inside that same canonical message pipeline. `GrottoModels` decodes the
Server's prepared-action projection on each message, and native Chat and Thread timelines render its
pending, committed, superseded, or unsupported lifecycle state. A pending `agent.create` action opens
an editable SwiftUI review sheet whose Computer, runtime, model, and reasoning choices come from the
Store's existing Server snapshots. Confirming the sheet calls `preparedAction.commit`; the client does
not create an Agent locally. A `prepared-action.updated` event refetches the affected loaded message
page, and an executed action also refreshes the Agent directory, so the action card itself becomes the
committed receipt and the new Agent appears from Server state. Suggested Computers remain editable;
a required Computer stays locked to the proposal and blocks creation while its inventory is unavailable.

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
rounded, local attachment portal; they do not create routes or full-screen covers. The portal card is
painted to the true screen bottom with corners that nest concentrically inside the display's, and the
keyboard slides out and back *behind* it: while a portal is open, the Chat screen freezes the keyboard
bottom inset it lays out against (`ComposerPortalFreeze`), so the transcript and composer stay
pixel-static for the portal's whole lifecycle and the keyboard is restored on close only if it was up
when the portal opened. That portal returns along the same bottom-leading path into the attachment
preview area so source, selection, and staged result remain spatially continuous. The composer itself
is a floating glass surface: the transcript scrolls to the screen bottom and passes beneath it via a
bottom safe-area inset rather than ending above an opaque band. Selected files stay in a composer-owned temporary directory
until the message succeeds, and imported security-scoped URLs are copied while access is active rather
than retained or buffered into memory. Chat-canvas staging belongs to the Chat, not the screen: it
survives a Chat switch and a push-over, and is discarded only by a successful send, by removing the
tile, or by the destination leaving the Server list. A Thread composer is screen-owned, so a popped
Thread abandons its staged files to the temporary directory. Sending reserves each file
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

The native Chat shell navigates over a typed destination rather than assuming every sidebar row is a
persisted Chat. A durable destination carries a Server Chat id; an implicit Agent-DM destination carries
only the Agent id. Every active Agent therefore appears in the sidebar before a DM exists. Its first
text send uses `chat.send` with `targetKind: agent-dm`, then adopts the Chat id from the receipt and never
creates a placeholder record. Materialized Agent and human DMs remain durable destinations; human peers
resolve their current name, handle, and avatar from the member directory, with a former-member fallback
when the directory no longer carries them.

Native composers query `chat.mentionOptions` against either that durable Chat or the implicit Agent-DM
target. Selecting an Agent or human writes the shared `agent://` or `user://` markdown reference into the
draft. Transcript chips parse that markdown and resolve live Agent/member identity by immutable id;
human references remain visual and do not create attention or notification behavior.

The open native Chat and Thread surfaces acknowledge the latest loaded message sequence through
`chat.markRead`. Identical Server/Chat/sequence acknowledgements are deduplicated in memory. The
durable `chat.read` event — which Server writes only when the read moved and addresses to the reader
alone — owns the `chat.list` refresh, exactly as the web App's `useChatRead` does, so one
acknowledgement produces one list refresh and unread counts remain Server projections rather than
local durable state.

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
floating gear control, pinned bottom-trailing over the scrolling chat list. The sidebar navigation
carries the App's own order: Server-wide destinations lead, then Channels, then DMs. The sidebar's
Server header is the Server menu, as the App's sidebar band is; archived chats open from there
rather than spending a navigation row. That header carries the Server's name and nothing else —
Agent and member counts are a Settings readout, not standing sidebar chrome — so `ServerPresentation`
carries only the identity the Chat surfaces render.

Every line in that sidebar starts on one rail: the Server identity, the section labels, and each
row's glyph share a single left edge, and one glyph box size puts the labels behind them on a single
column too. A row's selection capsule is the only thing outside the rail — it bleeds into the margin,
so the scrolling list is inset by the difference and each row re-adds it. Sections are plain labels,
not disclosures: a phone sidebar holds few enough rows that folding one saves nothing, and the caret
it would need is the one element that cannot sit on the rail with the rest.

An unread chat hangs a disc off the sidebar's leading edge and lets that edge cut it in half, so
what shows is a nub in the margin. The clip is load-bearing, which is why the rail inset rides on
the scrolling list rather than on the scroll view: the scroll view has to reach the sidebar's own
leading edge, or its bounds cut the marker away before the sidebar edge can halve it. The Chat
details sheet pushes a read-only Agent profile on its own `NavigationStack` — the chevron row is a
real push, and the sheet grows to the large detent for it — so inspection never leaves the sheet.
Editing does: the pushed profile's "Manage in Settings" row is the one details-to-Settings hop, and
it keeps the original choreography — the two sheets are mutually exclusive, so details dismisses
first and Settings presents from its dismissal, seeded to that Agent's Settings profile. A deep link
seeds the Settings sheet's navigation path, so the hub stays behind the pushed screen and the system
back button returns to it. The Settings
hub reads lightweight Server, Agent, member, and Computer projections; profile screens own focused
identity mutations; and long-form values use dedicated editors. Appearance is app-local presentation state and never creates or updates
Server state. Desktop-only operational surfaces remain out of the iPhone information architecture until
a concrete mobile workflow needs them.

The Swift client uses Apple platform frameworks for photos, camera, files, and Quick Look, plus the
official Clerk iOS SDK. It does not carry a second web or JavaScript UI system.
