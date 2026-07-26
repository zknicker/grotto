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
  sidecar hooks, or Electron IPC.
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
