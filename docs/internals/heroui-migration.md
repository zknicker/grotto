---
summary: Decisions and scope for the full Grotto UI migration from the BaseUI/COSS kit to HeroUI v3.
read_when:
  - doing any Grotto app UI work while the HeroUI migration is in progress
  - adding, styling, or retiring shared UI components in apps/website
  - deciding where navigation surfaces (server browser, sidebars, panes) live
---

# HeroUI Migration

The Grotto app UI is being fully ported from the mixed BaseUI/COSS/shadcn kit to
HeroUI v3 (`@heroui/react` + `@heroui-pro/react`). These are operator decisions,
not proposals.

## Decisions

1. **Total port, old kit retired.** The entire legacy `apps/website/src/components/ui`
   kit (BaseUI/COSS/shadcn mix) is replaced and deleted. No new call sites on the
   old kit; no long-term coexistence.
2. **Hooks and logic stay put.** React hooks, queries, realtime event handling,
   optimistic UI, and routing logic are not restructured in this migration. The
   port swaps the presentation layer; it must not break app behavior.
3. **Same UX, same places.** Pages, app layout, and data organization stay where
   they are: the same data lives on the same page/sidebar/pane. Within a page,
   the representation of that data may change freely — the old choice of
   components was an artifact of the mixed kits and does not need to be
   preserved.
4. **Stock components, central styling.** Use HeroUI components as they come.
   Customize via props (`variant`, `size`, semantic states) and compound parts.
   Do not style HeroUI internals through `className` at call sites. All custom
   visual identity lives in the design-system CSS layer: theme variables plus
   BEM class overrides, in one place, tweakable later. This migration exists to
   simplify — if a screen needs bespoke CSS scattered in components, the design
   is wrong.
   The theme layer (`apps/website/src/styles/grotto-theme.css`) is a **minimal
   override** of HeroUI's default theme, not a fork: it changes only what
   carries Grotto identity (accent, warm-stone neutral hue, radius, fonts) and
   inherits everything else. Every value must stay reproducible in the HeroUI
   Pro Design Systems editor so the theme can be maintained there and
   re-exported. Do not add derived/calculated token systems on top. Matching
   the retired kit's exact look is explicitly a non-goal — greenfield HeroUI
   wins over pixel continuity with the old UI.
5. **HeroUI best practices.** Tailwind v4, `@import "tailwindcss"` →
   `@import "@heroui/styles"` → `@import "@heroui-pro/react/css"` → project theme
   layer. Compound component anatomy (`Card.Header`, `Sheet.Content`), `onPress`
   over `onClick`, HeroUI semantic tokens (`bg-surface`, `text-muted`,
   `text-accent`), no numbered v2 tokens. Consult the HeroUI Pro MCP
   (`list_components` → `get_component_docs` → `get_css`) before implementing.
6. **HeroUI Pro carries the premium surfaces.** Use Pro components where they
   fit: `AppLayout`/`Sidebar`/`Navbar` for the shell, `Command` for the command
   menu, the AI suite (`ChatMessage`, `ChatConversation`, `PromptInput`,
   `ChainOfThought`, `CodeBlock`, `Markdown`) for chat, `Kanban` for the task
   board, Pro charts for stats.
7. **raft.build is the UX north star.** Grotto's UX is heavily inspired by Raft
   (an agentic chat product). When a layout or interaction question comes up,
   Raft's answer is the default. The current UI was assembled by several tools
   and does not have to be preserved where it deviates badly from Raft.
8. **Known UX corrections are in scope.** Example: the server browser/switcher
   currently lives in the second sidebar header; it belongs in the far-left
   icon rail (Raft/Discord pattern). Component organization and naming may be
   improved along the way using the composition patterns skill
   (`vercel-composition-patterns`).

9. **Icons stay HugeIcons.** HeroUI is icon-agnostic; the ~156 files importing
   HugeIcons keep them. No icon-set churn.
10. **The surface ladder retires.** The homegrown 8-level `--surface-*`
    elevation system is replaced by HeroUI's surface tokens
    (`bg-surface`, `bg-surface-secondary`, `bg-overlay`). Something more
    granular can return later if needed, as theme-layer tokens.

## Plan

Five phases, each a reviewable commit group on the migration branch; the app
must work after each phase.

1. **Demolition + foundation.** Delete dead code first (~5k LoC): the
   zero-importer `components/ui` files, all of `src/kit/`, the orphaned
   pre-hosted shell (`src/layout.tsx`, old sidebar chat list/actions, old
   command menu), and dead deps (dnd-kit, mdxeditor, tanstack-table/virtual,
   unused three/sigma graph stack). Install `@heroui/react` +
   `@heroui-pro/react` (bun `trustedDependencies`). Set up the CSS stack —
   `tailwindcss` → `@heroui/styles` → `@heroui-pro/react/css` → Grotto theme
   layer — and wire `data-theme` into the existing ThemeProvider. The theme
   layer is the design-system config: one CSS file mapping Grotto identity
   (dark-first, Geist + Reel, purple accent, current density) onto HeroUI
   variables + BEM overrides.
2. **Shell.** `AppLayout` + `Sidebar` + `Navbar` replace
   `app-shell`/`pane`/homegrown sidebar (content scroll mode; resizable aside
   for the artifact pane). Server browser moves into the icon rail
   (Raft pattern). Electron drag regions and traffic-light insets must keep
   working.
3. **Tool pages sweep.** Settings → members → tasks (board → `Kanban`) →
   reminders → computers → activity. Mechanical primitive swaps plus
   opportunistic composition cleanup (`vercel-composition-patterns`): the
   `X`/`hosted-X` duplication, the settings section if-chain, boolean-prop
   piles.
4. **Chat surface.** Pro AI suite (`ChatConversation`, `ChatMessage`,
   `PromptInput`, `ChainOfThought`, `CodeBlock`, `Markdown`) for
   transcript/messages/composer; the ProseMirror mention editor slots into
   `PromptInput` unchanged; tool steps and thread panel re-skinned.
5. **Retire.** Delete `components/ui` entirely; drop `@base-ui/react`,
   `@shadcn/react`, cva; rewrite `DESIGN.md` fully; repair e2e specs (they
   are role/text-based and will break broadly — budgeted per phase).

Quarantined (not ported, only token-remapped): the visx chart library
(`components/charts`), the ProseMirror mention composer internals
(`features/mentions`), `agent-face.tsx`. Token renames must be mirrored in
`src/widgets/visual-tokens.ts` and `features/chats/host-token-style.ts` or
sandboxed agent widgets render unthemed.

## Status

- Branch: `claude/grotto-ui-herui-refactor-*` worktree. Migration in progress;
  docs on this branch describe the target state.
- `DESIGN.md` carries the visual contract (tokens, density, typography voice);
  its HeroUI rewrite lands with the theme layer.
