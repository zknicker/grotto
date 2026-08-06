---
summary: React ownership and implementation conventions for routes, features, hooks, components, shell composition, forms, and realtime subscriptions.
read_when:
  - changing React file layout, shared UI ownership, frontend hooks, or presentation helpers
  - changing route structure, loading behavior, hooks, or component boundaries
  - reviewing React data ownership, Suspense usage, or presentation state
---

# React

For substantial React route, hook, query, realtime, optimistic UI, or state
architecture work, use the `architect-react-features` skill alongside this doc.

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

* Keep route files thin.
* Let route/page boundaries own `Suspense`, skeletons, and error boundaries.
* Keep primary page content mounted during background refreshes.
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
  controls HeroUI `Sidebar.Pages` so contextual navigation transitions without
  replacing the sidebar root.
* `ShellSidebar` must translate those slots into direct `Sidebar.Page` children.
  HeroUI derives slide position from direct child order; wrapping pages in
  feature components collapses that order and degrades the transition to a
  fade.
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
