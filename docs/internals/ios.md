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

Native settings use Expo Router destinations rather than drawer-local disclosure state. The Settings
hub reads lightweight Server, Agent, and member lists and carries the active Server id into profile
routes. Human and Agent profiles read focused detail snapshots at their screen leaves. Their existing
Server-backed identity and avatar mutations live in focused shared App-client hooks and refresh the
matching detail plus directory caches. Native image selection center-crops and downsizes to the shared
avatar contract before upload; the iPhone app never stores a second identity record. Settings compose
stock HeroUI Native grouped lists and controls. Profile pages keep short identity values such as names
editable inline and open long-form values such as descriptions in a focused HeroUI bottom-sheet editor.
Desktop-only operational surfaces such as model inventory, Skills, MCP connections,
Browser supervision, and destructive administration stay out of the iPhone information architecture
until a concrete mobile workflow needs them.

`apps/ios/src/components` owns reusable native presentation composed on top of HeroUI Native. These
components expose explicit compound slots and stable interaction behavior; feature code keeps its
drafts, mutations, validation, and product copy at the assembly site. `SettingsField` and
`SettingsSection` own the shared label inset, typography, HeroUI inline controls, and labeled ingress
rows. `TextEditorSheet` owns the HeroUI bottom sheet, borderless multiline input, delayed focus,
keyboard-frame layout, and confirmation control, while a Profile or future settings feature composes
its title, textarea, error, and submit action. Do not clone that behavior inside feature folders or add
product-mode boolean props to shared components.

## Dependencies

HeroUI Native is the only general UI component library. Discuss and approve any additional UI library
before adding it. Native infrastructure dependencies required by Expo, Expo Router, or HeroUI Native are
allowed when they implement platform capability rather than a second visual system.

HugeIcons Pro Rounded is the approved native icon family. Use Solid Rounded for content and action icons,
and Stroke Rounded for small disclosure arrows so their shape remains legible at compact sidebar sizes.
`AppIcon` bridges both sets to HeroUI semantic colors so icons and their surrounding HeroUI controls share
one theme-aware foreground. Import individual icons so Metro can tree-shake unused assets.

The generated `apps/ios/ios` directory is ignored. After app configuration or native dependency changes,
regenerate it with `bunx expo prebuild --platform ios --clean` and prove the result in an iPhone Simulator.
