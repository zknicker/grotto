---
summary: React conventions for route boundaries, Suspense, granular hooks, small components, forms, and realtime subscriptions.
read_when:
  - changing route structure, loading behavior, hooks, or component boundaries
  - reviewing React data ownership, Suspense usage, or presentation state
---

# React

For substantial React route, hook, query, realtime, optimistic UI, or state
architecture work, use the `react-best-practices` skill alongside this doc.

## Routes

* Keep route files thin.
* Let route/page boundaries own `Suspense`, skeletons, and error boundaries.
* Keep primary page content mounted during background refreshes.
* Treat empty synced database results as valid rendered states.
* Keep hosted Server routes structurally separate from local Runtime providers;
  do not suppress local requests after those providers have mounted.

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
* Hosted Chat hooks keep messages, lists, reads, and search in React Query.
  Durable reconnect events trigger cursor catch-up plus exact invalidation;
  composition events stay component-local and are discarded on unmount.

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
* Prefer nested compositional pieces with clear ownership. A route should choose
  ids and states; hooks should coordinate data; components should render view
  models and emit commands.

## Forms

* For TanStack React Form, treat fetched records as mount-time snapshots.
* Prefer record-load gates, explicit snapshot keys, and field-level bindings in
  leaf components.

Frontend layout lives in [frontend.md](frontend.md).
