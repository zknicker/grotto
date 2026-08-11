---
summary: React ownership and implementation conventions for routes, features, hooks, components, shell composition, forms, and realtime subscriptions.
read_when:
  - changing React file layout, shared UI ownership, frontend hooks, or presentation helpers
  - changing route structure, loading behavior, hooks, or component boundaries
  - reviewing React data ownership, Suspense usage, or presentation state
---

# React

Before changing React structure, behavior, data flow, or state, use the
`architect-react-features` skill alongside this doc.

## Change Workflow

1. **Trace ownership before editing.** Use `architect-react-features` to locate
   the route boundary, data reads, mutations, subscriptions, local state,
   effects, props, optimistic state, and cache owner affected by the request.
2. **Select composition rules when the component contract changes.** Use
   `vercel-composition-patterns` when changing component APIs, props,
   providers, context, shared state, reusable UI, or render variation. Read
   every matching rule from that skill before choosing the new shape.
3. **Complete the product change.** Delete the replaced path; finish the
   requested behavior and cleanup.
4. **Audit the completed diff before verification.** Reapply the relevant skill
   audits. Confirm that data-aware leaves use focused hooks, props describe
   identity or genuine render variation, context owns shared UI behavior,
   effects synchronize external systems, variants are explicit, and cache
   updates have one owner.
5. **Verify after the architecture is settled.** Use
   [Change Routing](../operations/testing.md#change-routing) to select the
   smallest proof from the completed diff.

Lift state or introduce a provider only when sibling regions genuinely share
UI behavior or one external lifecycle. Composition guidance does not override
Grotto's data ownership: durable server state stays in React Query, data-aware
leaves call focused hooks, and context does not distribute a fetched data
graph.

## Ownership

The frontend is organized by capability:

| Area | Owns |
| --- | --- |
| `routes/` | Thin route entrypoints and route-level boundaries |
| `features/` | Page and workflow composition plus feature-local state |
| `commands/` | Global command definitions grouped by product capability |
| `components/` | Reusable presentation owned by a product capability |
| `hooks/` | Reusable data, mutation, and event capabilities |
| `lib/` | Non-React formatting, view models, and boundary adapters |

Promote reusable chat, Agent, task, reminder, or stats code to its matching
capability. Avoid generic `shared`, `common`, `helpers`, and `misc` buckets when
a product owner exists. Prefer short names scoped by folders.

## Routes

### Loading and navigation

Keep the destination shell mounted while its first snapshot resolves. An unresolved query is not
an empty collection: reserve a neutral data region until the query settles, and show an empty state
only after a successful empty result. Keep surrounding navigation and page structure mounted, but
do not add loading decoration for ordinary fast reads. When cached data exists, keep it visible
through background refreshes instead of replacing the page with a loading state. Durable synced
queries should use the shared synced-snapshot query policy so ordinary back-and-forth navigation
reuses the latest local snapshot while realtime invalidations refresh it.

* Keep route files thin.
* Let route/page boundaries own `Suspense`, skeletons, and error boundaries.
* Keep primary page content mounted during background refreshes.
* Keep the authenticated Server shell mounted across Clerk token rotation and
  websocket reconnects. Transport credentials and connection generations must not
  become React keys. Only a genuine human identity change may clear hosted query
  ownership or replace the authenticated surface; key that identity-owned provider
  by the known Clerk user id rather than clearing a shared cache after render.
* Keep primary Server destinations code-split, but share their cached module
  loaders between router navigation and preloading. The persistent shell warms
  them while idle; rail hover warms the destination before selection.
* Treat empty synced database results as valid rendered states.
* Keep hosted Server routes structurally separate from local Runtime providers;
  do not suppress local requests after those providers have mounted.
* Keep `/s/*` in the hosted route-tree branch. It may mount hosted tRPC and
  Server hooks, but not local command menus, Runtime gates, sidecar hooks, or
  Electron IPC.

## Shell

* `ServerLayout` owns the stable `AppLayout` scaffold and one persistent
  `ShellSidebar`. Sections compose `ShellSidebarPage` slots; route state
  selects one slot without replacing the sidebar root. Search and Reminders
  are full-width destinations and do not show contextual navigation.
  Returning to Chat resolves the remembered valid Chat directly instead of
  rendering the Server entry redirect between rail destinations.
* `ShellSidebar` mounts only the active page descriptor. Left-sidebar changes
  are navigation, not disclosure, so they are instant and inactive page controls
  never enter the accessibility tree. Routes that add or remove the contextual
  left sidebar also reflow immediately; right-side chat panes retain their own
  open and close motion.
* The shell renders one `ShellTopbar`. Pages compose its content through
  `PageTopbar` and `SectionHeader`. Embedded surfaces use `SectionBar`.
* Chat side panes portal into the shell-level side-pane slot so their header
  sits beside the chat topbar and their body spans the full app content height.
  Pane state and content remain owned by the active chat. Every pane kind uses
  `ChatSidePaneShell` for width and motion; panes with local drafts stay mounted,
  inert, and accessibility-hidden while another pane temporarily owns the slot.
  Keep the pane shell's identity stable when its selected target changes; key
  target-specific content below the shell instead.
* Shell chrome, traffic-light clearance, topbar height, and panel seams belong
  to the shell components, not feature pages.
* Global command definitions live under `src/commands`; the shell only renders
  their groups.

## Hooks

* Wrap tRPC React Query calls in capability hooks.
* Keep hooks narrow and data-first.
* Promote reusable hooks to `src/hooks/<capability>` once ownership is clear.
* Colocate feature-only hooks with the feature.
* Keep durable server state in React Query. Use scoped context or a tiny feature
  store only for volatile UI state that has not become durable server data.
* For chat and other streaming surfaces, patch exact volatile state from live
  events. Do not refetch durable list or log queries for every progress token.
* Effects are for external synchronization, not derived state.
* Chat hooks keep messages, lists, reads, and search in React Query.
  Durable reconnect events trigger cursor catch-up plus exact invalidation;
  composition events stay component-local and are discarded on unmount.
  Selected attachment `File` objects stay composer-local; durable messages
  retain only attachment metadata, and authenticated byte transfer stays in
  focused attachment hooks.
* Attachment hooks reserve metadata over tRPC and transfer bytes directly
  against the app origin with a fresh Clerk token. Do not convert
  attachment bytes into message-query data.

## Queries

* Name APIs as `<namespace>.<verb>` unless a narrower exception is clearer.
* Make `*.list` the normal lightweight list read for a namespace.
* Use focused `*.get` reads for detail screens.
* Invalidate list reads for membership or ordering changes.
* Invalidate detail reads for single-record changes.

### Query Policy

Server events own cache invalidation; `staleTime` is only the fallback floor.
The contract is executable in
`apps/website/src/lib/query-policy-contract.test.ts` — do not widen its
allowlists to make it pass.

* Every `useQuery` declares a named `queryPolicy` preset from
  `lib/query-policy.ts` (or an explicit `staleTime` with a stated reason).
  Both tRPC clients share a 30s default `staleTime` floor so an unpoliced
  one-off query cannot refetch on every mount.
* Event listener hooks are the single invalidation owner for their namespace.
  Mutations do not re-invalidate what a durable event already covers; at most
  they keep one narrow un-awaited invalidate as an ack fallback.
* Listeners branch per event type and invalidate only the queries whose
  rendered payload the event changes. Ground new branches in what the list
  procedure actually returns, not in what sounds related.
* Never set `refetchOnMount: false` on a query that unmounts with navigation.
  Invalidation marks inactive queries stale without refetching them, so the
  stale-gated mount refetch (the React Query default) is what delivers those
  changes on remount.
* Never put a tRPC utils proxy path (`utils.chat.x`) in a dependency array —
  each property access is a fresh object. Depend on the stable `utils` root
  and the memoized input value instead.
* Show user-authored sends as app-local pending rows immediately; do not block
  the composer on server acks or awaited invalidation fan-outs.

## Components

* Keep files small and focused.
* Pass small domain props or local view models, not whole query objects.
* Split large views by responsibility before adding more branching.
* Share reusable rows, badges, grouping helpers, formatting, and view helpers;
  avoid wrapper-only component chains.
* Prefer nested compositional pieces with clear ownership. Routes pass stable
  identity into a feature page. Data-aware leaves call the focused query or
  mutation hooks they need; React Query shares cached reads across those leaves.
  Keep state at a feature root only when multiple sibling regions must coordinate
  it, such as Chat view selection, the active Thread, or one shared realtime
  lifecycle stream.
* Do not fetch a feature's full data graph in a route, place it in context, or
  forward it through controller props. Context is for a stable cross-cutting
  capability, not a substitute for leaf-owned hooks.
* Compose HeroUI compound parts directly. Chat composers use Pro
  `PromptInput.Shell`, `PromptInput.Content`, and `PromptInput.Toolbar`; do not
  recreate a monolithic app-level PromptInput primitive.
* Grotto Modals and AlertDialogs set `isDismissable` on their Backdrop so
  clicking outside the dialog acts like Cancel.
* Composer `@`/`$` autocomplete and transcript reference rendering belong to
  the mentions capability. See [Rich References](../features/rich-references.md).

## Styling

* `styles/global.css` owns import order and document defaults only.
* `styles/default-theme.css` and root `DESIGN.md` are the generated exports
  from the saved HeroUI Pro design system. Replace them together; never
  hand-edit either file.
* `styles/product-tokens.css` owns only cross-feature product concepts HeroUI
  cannot provide, currently sender differentiation and task-label colors.
* `styles/artifact-tokens.css` is the stable compatibility boundary for
  durable agent-authored HTML. Product components must not use its aliases.
* Feature behavior CSS stays beside its owner, such as chat motion and the
  Electron shell. It must not restyle HeroUI component appearance.
* Use HeroUI semantic utilities directly. Add a custom token only when the
  value represents a durable product concept rather than a component,
  feature implementation, or alternate name for an existing HeroUI role.

## Forms

* For TanStack React Form, treat fetched records as mount-time snapshots.
* Prefer record-load gates, explicit snapshot keys, and field-level bindings in
  leaf components.
