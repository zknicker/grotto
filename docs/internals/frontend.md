---
summary: Frontend ownership rules for routes, features, components, hooks, lib helpers, and reusable UI promotion.
read_when:
  - changing React file layout, shared UI ownership, frontend hooks, or presentation helpers
  - moving reusable UI between route, feature, component, hook, or lib folders
---

# Frontend

The frontend is organized by ownership. Put reusable primitives where the
capability lives; keep route and feature folders for page assembly.

## Layout

| Area | Purpose |
| --- | --- |
| `routes/` | Thin route entrypoints |
| `features/` | Page and workflow composition |
| `commands/` | Global command menu definitions grouped by product capability |
| `components/` | Reusable UI owned by a capability |
| `kit/` | Tavern component kit: shared presentational components behind widgets, dashboards, and sandboxed agent pages ([kit.md](kit.md)) |
| `hooks/` | App-level data and event hooks owned by a capability |
| `lib/` | Non-React formatting, view models, and adapters |

## Rules

* App sections may supply their own shell sidebar: the server layout picks the
  sidebar component per active section (chat sections get the channel sidebar;
  settings and tasks provide their own). A section sidebar is owned by its
  feature folder, renders HeroUI `Sidebar` parts, and drives selection through
  routes or URL search params — never through state shared with the page.
* The shell owns the topbar. The server layout renders one `ShellTopbar` band
  above the routed content; pages fill it with
  `<PageTopbar><SectionHeader …/></PageTopbar>`
  (`features/shell/shell-topbar.tsx`). Band chrome — height, hairline,
  gutter — lives only in `SectionBar`; never hand-roll a page header with
  its own height. Embedded surfaces that need a local band inside content
  (a side panel, a tab body) render `SectionBar` directly. Portaled topbar
  content does not appear in `renderToStaticMarkup` — test band content by
  rendering it directly, not through the page.
* Promote shared chat, agent, automation, or stats UI to the matching
  `components/<capability>` or `hooks/<capability>` folder.
* Keep global command menu actions under `src/commands`. Command modules own
  search labels, keywords, disabled reasons, and route/action callbacks; the
  shell command menu only renders groups.
* Composer `@`/`$` autocomplete, rich reference badges, and transcript
  reference rendering belong to the mentions product area, not a tool-specific
  feature. See [Rich References](../../specs/mentions.md).
* Keep feature folders for page-specific orchestration and local state.
* Keep `/s/*` in the hosted route-tree branch. It may mount the hosted tRPC
  provider and Server hooks, but not the local Command menu, Runtime gates,
  sidecar hooks, or Electron IPC. Hosted attachment hooks reserve metadata over
  tRPC and upload/download bytes directly against the hosted origin with a
  fresh Clerk token; never convert bytes into message query data.
* Move chat workflow orchestration, optimistic reconciliation, and event cache
  handling into `hooks/chats`. Chat feature components should receive ids,
  narrow view models, and command callbacks.
* Composer surfaces use `components/ui/prompt-input.tsx` slot components such as
  `PromptInput`, `PromptInputBody`, `PromptInputTextarea`, `PromptInputFooter`,
  `PromptInputTools`, and `PromptInputSubmit`. Feature components assemble those
  slots; avoid monolithic composer wrappers that own toolbar layout or disabled
  state.
* Avoid generic buckets such as `shared`, `common`, `helpers`, and `misc` when
  a clearer owner exists.
* Prefer short names scoped by folders over long prefixed filenames.

React conventions live in [react.md](react.md).
