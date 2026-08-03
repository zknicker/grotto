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
   The theme variant (`apps/website/src/styles/grotto-theme.css`) **starts as
   HeroUI's default theme with zero overrides** and is still near-empty. It is
   exactly the design-system customization set and nothing else — Grotto's own
   product tokens live in `grotto-base.css` — so it round-trips with
   the HeroUI Pro Design Systems editor (heroui.pro/dashboard/ds): the
   editor's Import accepts pasted CSS variables (replace semantics — anything
   absent resets to default), and saved design systems pull back into the
   repo via the MCP design-system export tools. Author identity (accent, base
   color, fonts, radius) in the editor, land its export in this one file. Do
   not add derived/calculated token systems on top. Matching the retired
   kit's exact look is explicitly a non-goal — greenfield HeroUI defaults win
   over pixel continuity with the old UI. Phase 6 deleted the retired
   kit's `tokens.css` entirely. The CSS stack is now three files:
   `grotto-base.css` (the product tokens extending HeroUI's base, plus the
   component rules consuming them — HeroUI's base plus this file IS the
   default theme), `artifact-tokens.css` (the small stable vocabulary
   published to agent-authored artifacts — pure aliases onto that base, so a
   durable artifact survives HeroUI renames and theme swaps), and `grotto-theme.css` (the `*-theme.css`
   tweak slot, imported last, currently near-empty because Grotto runs the
   default theme). HeroUI owns every semantic name and is never redefined.
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

Quarantined (not ported, only token-remapped): the ProseMirror mention
composer internals
(`features/mentions`). Token renames must be mirrored in the one
published list (`src/agent-html/tokens.ts`) or agent-authored HTML renders
unthemed.

## Dependency notes

- `@heroui-pro/react`'s barrel statically imports every component, so its full
  peer set must be installed even for unused components (tiptap,
  shiki, streamdown, maplibre-gl, …).
- `maplibre-gl` is pinned to 5.x: Pro's map component default-imports it and
  maplibre 6 removed the default export, which breaks Vite dep optimization
  for the entire Pro barrel. Grotto renders no maps — the dep is build-time
  only. Revisit the pin whenever `@heroui-pro/react` is upgraded.

## Status

- Branch: `claude/grotto-ui-herui-refactor-*` worktree. Docs on this branch
  describe the target state.
- Phases 1–3 are DONE (2026-07-31): foundation + defaults-first theme file,
  the AppLayout/Sidebar/rail shell, and every tool page — settings (all
  sections), members + agent profile, tasks (Pro Kanban board and a
  Linear-style grouped list adapted from the operator's "Tracker Issue
  Manager" HeroUI AI Chat generation), reminders, computers, skills,
  overview chrome, and the no-server flow.
- Phase 4 is DONE (2026-07-31): chat topbar on the shared `SectionHeader`
  band, view tabs on HeroUI Tabs, turn/tool drawers on stock HeroUI
  Drawer, composer on Pro `PromptInput` (ProseMirror mention editor
  slotted into `PromptInput.Content` unchanged; Pro `ChatAttachment`
  tiles for staged files), channel dialog / agent hover card / thread
  menus on Modal / Pro HoverCard / Pro ContextMenu, thread panel on the
  shared band metrics, and the artifact panel on Dropdown/ScrollShadow/
  SearchField with a chat-owned closeable tab strip (RAC Tabs cannot
  express per-tab close buttons). The transcript keeps its homegrown
  Slack-roster containers — Pro `ChatMessage` is a two-party AI-chat
  layout and does not fit a multi-party roster — now living in
  `components/chats/` (message-scroller, message, bubble, day-divider,
  attachment) on semantic tokens only. The workspace file tree stays on
  `@pierre/trees` (Pro FileTree has no imperative/controlled API),
  matching the skills tree. Dead tavern-era chat chrome and the
  scripted-turn dev toolkit were deleted outright; sidebar rosters got a
  shared `HostedAgentRailAvatar` (presence dot outset past the visual
  corner with a `ring-background` separation). The sub-32px slots stock
  Avatar has no size for are served by passing `EntityAvatar` a pixel
  number; the app has exactly one avatar component and one radius. See
  [Avatars](avatars.md).
- Deliberate divergences from HeroUI's own scales, living in
  `grotto-base.css` as tokens plus the BEM overrides that consume them.
  Because they are part of the base rather than a theme variant, a
  `*-theme.css` (or a Design Systems export) retunes them by setting the
  token — it never has to restate the rules. Never redefine a name HeroUI
  already owns.
  - `--avatar-radius` (30%) on `.avatar`. HeroUI scales avatar radius per
    size; we want one shape at every size, and a rounded square rather
    than a circle. `ChannelIconBox` consumes the same token.
  - `--sidebar-row-radius` (12px) on `.sidebar__menu-item-content`. Pro's
    `rounded-2xl` row is 44% of a 36px row — a stadium wrapping a 30%
    square mark. 12px puts the container in the avatar's shape family.
  - `--presence-ring` (defaults to `--background`) rescoped to `--default`
    on hovered/current rows. Not an identity choice but a fix: an opaque
    ring standing in for the backdrop is HeroUI's own Badge technique
    (`--badge-border`), and it needs rescoping wherever a surface paints
    its own fill.
- Theme-layer follow-ups collected during phase 4 (all belong in
  `grotto-theme.css` or `grotto-base.css`, never call sites): drawer width — stock HeroUI side
  drawer is a fixed `w-96`, too narrow for diffs/terminal output (was
  36–40rem); circular send button for the composer if wanted (stock
  Button radius is rounded, radius is not a prop). Known stock trade-off:
  the artifact tab strip lost base-ui's arrow-key roving focus
  (click/Enter selection now), and legacy three-tier muted text collapsed
  to HeroUI's two tiers.
- Phase 5 kit retirement is DONE (2026-07-31). `components/ui/` holds
  exactly four surviving components, each with a reason: `icon.tsx` (the
  HugeIcons render adapter — decision 9), `app-shell.tsx` (Electron
  native window-drag plumbing only; its Base UI utilities and dead
  layout exports were removed), `status-dot.tsx` (no stock HeroUI
  presence-dot exists; de-cva'd), and `resizable-pane-rail.tsx`
  (drag-resize behavior for the artifact pane). Everything else was
  ported to stock HeroUI or deleted: server dialogs → AlertDialog,
  command menu → Pro Command (RAC's built-in filtering replaced the
  homegrown group filter), toasts → stock `toast` (HeroUI 3.2.2 ships
  one), manage-servers → Modal, search results → Pro ListView, gates and
  member list → Button/Chip/TextField, code-snippet + copy-button →
  `components/` on stock parts, image-lightbox → bespoke viewer on
  react-aria-components primitives, desktop edit menu →
  `features/shell/` with intentionally native-macOS chrome. Known
  gotchas recorded on the way: Clerk `SignInButton` cannot drive a React
  Aria Button (cloned `onClick` is dropped) — call `clerk.openSignIn()`
  directly; Pro `CodeBlock`'s copy lacks the repo's clipboard
  `execCommand` fallback.
- Fast-follow candidates: evaluate Pro `Resizable`
  (react-resizable-panels) as a replacement for `resizable-pane-rail` +
  the side-pane width plumbing (implies rethinking the open/close width
  animation and pixel-width persistence); `hosted-human-directory.tsx`
  still carries legacy-styled section headers.
- Phase 5, badge + copy-button (2026-07-31): `components/ui/badge.tsx` is
  deleted — every badge is a HeroUI `Chip`. Legacy `destructive` maps to
  `color="danger"`, `success`/`warning`/`info` to the matching Chip color,
  and the quiet plates (`secondary`, `subtle`, `chip`) to `variant="soft"`
  or `variant="secondary"`. The per-provider `color-mix` tint on
  `ModelProviderBadge` is gone: the chip is a stock neutral plate and
  `ModelProviderLogo` alone carries the brand color, so no call site
  hand-rolls color. `copy-button` moved out of the retiring kit to
  `components/copy-button.tsx` on HeroUI `Button` + `Tooltip`; its
  `className` still lands on the button element so call sites keep driving
  placement and their own `group-hover` reveal.
- Phase 5, allowed-tools input (2026-07-31): `features/skills/allowed-tools-input.tsx`
  was the last Base UI consumer — and turned out to have zero call sites on
  `origin/main` too. Deleted rather than ported (an exploratory HeroUI
  ComboBox + TagGroup port exists in this branch's history if the surface
  returns). With this, `@base-ui/react` and `class-variance-authority` are
  removed from `apps/website/package.json`; `@shadcn/react` remains SOLELY
  for the tuned message-scroller mechanics vendored behind
  `components/chats/message-scroller.tsx` — replace it with Pro
  ChatConversation/StickToBottom or a vendored implementation when someone
  is ready to re-tune chat scroll behavior.
- Browser E2E now targets the hosted App and Server stack exclusively. The
  retired local Runtime harness and its stale selectors were removed; current
  Agent, settings, messaging, task, reminder, membership, and Computer
  contracts run against isolated PostgreSQL and Clerk fixtures. Real
  Computer/model behavior remains in Agent E2E.
- Still open: the `DESIGN.md` rewrite around HeroUI.
