---
version: alpha
name: Tavern
description: Quiet desktop control-plane UI for agents, runtime state, memory, jobs, chats, and settings.
colors:
  background: "#f8f8f8"
  foreground: "#292524"
  chrome: "#fbf9f6"
  brand: "#7b51cc"
  brand-foreground: "#f7f4ff"
  card: "#ffffff"
  popover: "#ffffff"
  primary: "#1b1b1b"
  primary-foreground: "#fafaf9"
  secondary: "#f0efec"
  secondary-foreground: "#292524"
  muted: "#f1efec"
  muted-foreground: "#6b6660"
  accent: "#f1efec"
  border: "#dcdad7"
  input: "#cdcac8"
  success: "#10b981"
  warning: "#f59e0b"
  error: "#ef4444"
  info: "#3b82f6"
typography:
  body:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  body-compact:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
  badge:
    fontFamily: "Geist Mono, SFMono-Regular, SF Mono, Consolas, Liberation Mono, monospace"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.025em
  mono-meta:
    fontFamily: "Geist Mono, SFMono-Regular, SF Mono, Consolas, Liberation Mono, monospace"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: 0.3125rem
  md: 0.4375rem
  lg: 0.5625rem
  xl: 1.12rem
  2xl: 0.9375rem
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  section: 2.5rem
components:
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.lg}"
    height: 2rem
    padding: 0.75rem
  input:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: 2rem
  select:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: 2rem
  badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.badge}"
    rounded: "{rounded.sm}"
  settings-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    padding: 1.25rem
---

## Overview

Tavern is a dense, quiet desktop control-plane app. The interface should feel closer to Codex than
to a marketing dashboard: restrained, highly scannable, compact, and built for repeated use by an
operator who already understands the product.

The current visual north star is [`docs/assets/tavern-north-star-home.png`](docs/assets/tavern-north-star-home.png).
Use it as directional reference for the product feel: warm Tavern identity, agent activity as a
living operational scene, and dashboard information kept readable and actionable.

The design system source of truth is code, not this prose:

- Theme tokens live in `apps/website/src/styles/global.css`.
- Shared primitives live in `apps/website/src/components/ui`.
- Product-specific badge treatments live in `apps/website/src/components/badges`.
- The app uses COSS UI components backed by Base UI. Do not introduce shadcn or Radix primitives.

Prefer existing UI primitives exactly as they are. If a screen looks wrong, first improve the shared
primitive or global token that owns the issue. Only add local classes when the local layout genuinely
needs them.

## Colors

Use `apps/website/src/styles/global.css` tokens for all app colors. Do not hardcode ad hoc hex,
Tailwind palette classes, or opacity mixes in feature components unless the value is a product
brand color or provider badge treatment.

The palette is flat and near-white on two grounds: the shell (icon rail + sidebar panels) sits on
neutral `#f8f8f8` (`--background` — never pink) and the main content column is stark white
(`--content-card`); the main column rescopes `--background` to white so content-side surfaces
resolve against their own ground. Every other light surface
derives from, with a warm charcoal dark theme. The UI itself stays quiet and gets out of the way;
color arrives through accents — the brand pill, status colors, and the agents' single-color
thick-outline avatars. Borders and secondary surfaces are solid opaque values, not alpha washes —
they should read like drawn lines and flat fills, matching the avatar doodle style (avatar ink is
`#1b1b1b`, which is also `--primary` in light mode).
`--brand` (`#7b51cc`) is reserved for primary emphasis and accents. Selected nav rows — sidebar
sections, channels, DMs, settings nav, and file-tree rows alike — use the inked outline +
press-slab treatment (solid `--secondary` fill, inset `--input` ring, 2px `--hard-shadow`
offset), matching the button language. Generic selection highlights (tabs, tables, select items)
use the subtle `--active` tint.

The token palette is neutral-first:

- `background`, `foreground`, `card`, `popover`, `border`, `muted`, `input`, and `secondary` carry
  most UI surfaces.
- `brand` is reserved for strong product emphasis, selected states, and primary actions.
- `border-subtle` (`border-border-subtle`) is the lighter opaque hairline for quiet seams inside
  content surfaces — use it instead of alpha washes such as `border-border/60`.
- `success`, `warning`, `error`, and `info` are semantic status colors.
- `sidebar-*` tokens own navigation surfaces and should not be replicated in feature code.

Buttons, inputs, selects, badges, cards, tables, alerts, sidebars, and switches must consume
semantic tokens through the shared primitives. To change global color behavior, edit
`global.css` and the primitive together.

Avoid border-in-border compositions. When a control sits inside a card, prefer subtle filled
surfaces such as `bg-muted`, `bg-input`, or the primitive's default treatment over another strong
outline.

Provider and product badges may use special colors, but they should still be implemented as
specializations of `components/ui/badge.tsx` in `components/badges`.

## Surfaces

`components/ui/surface.tsx` carries the Fluid Functionalism surface ladder: eight
`surface-N`/`shadow-surface-N` token pairs defined in `global.css`, a substrate context, and the
`Elevated` primitive. Containers communicate their level through context, so a panel nested inside
a dialog lands one step above the dialog without prop threading.

Use `Elevated` with small offsets for nested panels instead of hand-picking backgrounds: offset 1
for inline low-contrast cards (system evidence in chat, for example), offset 2 for popovers and
menus, offset 4 for dialogs. Pass `shadowLevel` when a floating element should keep a constant
shadow weight regardless of nesting. Dark mode steps the background a few percent toward white per
level; light mode flattens to white after level 2 and lets the shadow recipes carry elevation.

## Typography

The app uses Geist for UI, Geist Mono for compact metadata, and Reel Medium Bold (Jamie Clarke
Type, `font-display`) for the logo and page-level display headings only: the home greeting,
settings page titles, and onboarding. The display face never appears below `text-2xl`; body and
section text stay Geist. The vendored Reel is the trial cut (no V/v, minimal punctuation — missing
glyphs fall back to Geist); license the full family before shipping. The typography scale is
defined in `global.css`; `--app-ui-font-size` owns UI text and `--app-code-font-size` owns code
surfaces. Tavern's default UI text is 14px through `--app-ui-font-size`; do not assume browser
defaults, Tailwind defaults, or upstream COSS defaults define Tavern's body size.

Use `text-sm` for normal app UI, labels, rows, buttons, empty states, and body text. In Tavern,
`text-sm` is the standard body scale because it maps to `--app-ui-font-size`. `text-base` is larger
than normal app body text and should be reserved for card titles, section headers, and intentionally
larger emphasis. Use `text-meta` for compact metadata such as timestamps, durations, short row
details, and secondary table cells. Use `text-caption` or `text-micro` only for badges, ticks, and
tiny labels. Avoid `text-xs` for ordinary content; it usually makes dense settings screens feel
inconsistent.

Badges use mono, uppercase, and slight positive tracking. This is a primitive-level decision in
`components/ui/badge.tsx`; do not recreate it with local classes.

Section labels share that voice: sidebar group labels are mono, uppercase, `text-xs` with
`tracking-wider`; content-area section titles (settings sections, dividers) step up to `text-sm`
so the hierarchy reads nav label < section title. Row titles, descriptions, and body content stay
Geist sentence case — the mono-uppercase treatment marks structure, never content.

Use short plain product language. Settings descriptions should usually be one line and disposable:
"Capture memories.", "Build knowledge.", "Maintain memory." If the description wraps or explains
the obvious, shorten it or remove it.

## Layout

The app is a traditional chat layout with a persistent 48px icon rail: the rail carries Search,
Chat, Activity, Tasks, Reminders, Members, and Settings as icon buttons on every route. The chat
sidebar remains beside Chat and Activity; full-width tools collapse it, Members supplies its own
list panel, and Settings swaps in the settings nav.
The inner shell is built from the Pane kit (`components/ui/pane.tsx`): `Pane` columns,
`PaneTopbar` chrome rows, `PaneBody` content regions, and `SidePane` docked asides. Every chrome
row is one `PaneTopbar` — `--content-topbar-height` (40px) tall with the bottom hairline drawn
inside that height — and every docked aside is a `SidePane`, so seams land on the same pixel
across neighboring panes. `--topbar-height` (48px) is only the traffic-light headroom above the
rail and panels; side columns clear it with the `app-shell-sidebar-top-inset` class. Do not hand-roll
header rows or aside seams in feature code. Chat topbars carry room identity on the left
(channels get a name dropdown with channel actions and the clickable description, both opening
the Edit channel dialog) and quiet controls on the right: a people-glyph participant count (opens
the participants dialog on channels) and the pane toggle — no facepiles or card-in-card pills in
the bar. Tool pages carry their own toolbars. The topbar's bottom hairline and every panel seam
use `--content-card-border` so the frame reads as one set of straight lines. There is no browser-tab strip, breadcrumb toolbar, or history control row
anywhere — web and desktop share this one shell, and the desktop window reserves the topbar
band for the macOS traffic lights. The Workspace page is retired from navigation (workspace
files are reached through the chat artifact pane).

Tavern screens should be operational, not editorial:

- Build the actual tool as the first screen, not a landing page.
- Use compact full-width sections with constrained inner content.
- Use `BadgeDivider` for section labels and separators.
- Leave more vertical space between settings sections than between rows inside a section.
- Keep settings rows aligned to a fixed value column so controls line up.
- Prefer dense lists and tables for status, logs, schedules, and repeated operational entities.
- Chat transcripts are Slack-style: every message — the owner's included — renders in one dense
  left-aligned roster (avatar, name header, plain text). No right-anchored self bubbles. The lane
  is full width on a shared `px-5` gutter — transcript, composer, and status stack align to it;
  there is no centered max-width column and no turn-timeline rail.

Settings pages should mostly use:

- `BadgeDivider`
- `SettingsGroup`
- `SettingsRow`
- COSS UI primitives from `components/ui`

Do not introduce page-local card-header mashups or custom row components when the shared settings
primitives are enough.

## Elevation & Depth

Use minimal depth. The surface ladder is flat: levels 1-4 draw only a solid hairline ring (no drop
shadows); real overlays (5+) add one soft ambient drop. The hard offset slab is reserved for
buttons alone: solid variants carry a 2px press slab (`--hard-shadow`) that collapses while the
button translates down on press; ghost, link, soft, and chrome variants stay flush. That press slab
is the app's only neo-brutalist shadow — do not spread it to cards, popovers, or panels. No gloss
inset highlights or colored shadows anywhere.

Tables and settings groups can sit inside subtle card surfaces when they are a contained tool, but
avoid nested cards. A control inside a card should look like a control, not like another card.

Use hover states that visibly change the surface. For muted controls, remember that alpha tokens
such as `secondary` may need to hover toward `input` or `accent` rather than `secondary/90`.
List rows and card-like buttons should change state immediately. Do not add transition classes to
basic hover, focus, or selected surface changes unless motion communicates a workflow transition.

## Shapes

Corners are squarer than the COSS default: `--corner-radius-scale` is 0.75 (0.9 with superellipse
support), applied on top of the base radii below.

Default interactive controls use modest radii:

- Buttons, inputs, selects, menus, and popovers use `rounded-lg`.
- Badges use `rounded-sm`.
- Cards use `rounded-xl` at most. Large framed cards should feel softly rounded, around 22px in
  browsers that support the app's corner-shape scale.
- Avoid pill shapes unless the primitive intentionally owns that style, such as a section badge.

Do not use decorative gradient orbs, bokeh blobs, or ornamental SVG backgrounds in app surfaces.

## Focus

Keyboard focus is one consistent ring across the app. A global `:focus-visible`
base rule (`apps/website/src/styles/global.css`) draws a 2px `--ring` outline at
`1px` offset, so every focusable element matches without per-component work and
nothing falls through to the browser's default outline.

Opt out only when a control needs a bespoke focus look. Set the `outline-none`
utility (it beats the base rule) and supply the alternative:

- The Button primitive and most controls use a `focus-visible:ring-2
  focus-visible:ring-ring` box-shadow ring with `ring-offset-1`.
- Full-bleed rows inside an `overflow-hidden` or scrolling container (e.g. chat
  tool rows) use the same ring but `ring-inset`, so it is not clipped and does
  not bleed into stacked neighbors.
- Form fields focus their border color rather than drawing a ring.

Do not rely on `focus-within` to reveal hover affordances on a control that
opens an overlay — focus returns to the trigger on close and the affordance
sticks. Key such reveals to `focus-visible` (e.g. `group-has-focus-visible`).

## Components

Start with `apps/website/src/components/ui` for every shared UI need. The most important primitives
are:

- `primitives/button.tsx`
- `primitives/input.tsx`
- `primitives/search-input.tsx`
- `select.tsx`
- `switch.tsx`
- `badge.tsx`
- `badge-divider.tsx`
- `settings-row.tsx`
- `card.tsx`
- `alert.tsx`
- `data-table.tsx`
- `code-snippet.tsx`
- `sidebar/*`
- `menu.tsx`, `dialog.tsx`, `popover.tsx`, `tooltip.tsx`

Use these primitives without modification at the call site whenever possible. Prefer component
props such as `size` and `variant` over local `className` overrides. If a primitive lacks a needed
variant, add it to the primitive so the system remains consistent.

Use `secondary` instead of `outline` for most app buttons. The interface already has many framed
surfaces; outline buttons often create extra visual noise.

Use `Alert` for callouts. Do not create page-local callout components for standard messages.

Use `CodeSnippet` for path-like or command-like values that need a gray code surface and copy
button. Do not hand-roll copy boxes.

Use HugeIcons for app icons, usually the solid rounded variant. Icons should generally inherit the
same color behavior as their text unless a provider or status treatment intentionally owns color.
Use `components/ui/spinner.tsx` for loading/running indicators; it owns the app-wide bare
`Loading03Icon` rotating treatment.

Toasts are single-line, content-hugging, and glassy (blurred translucent popover surface): a type
icon, a bold title, and an optional muted description that truncates. Write toast copy to be read
in a glance — a short title, at most one short clause of description. Optimistic saves should not
show a loading toast; surface failures only. Saves that restart the agent engine get one promise
toast per restart cycle.

## Loading & Transitions

Do not render a bare text fallback such as "Loading transcript..." or "Loading details..." in place
of a primary content area. Keep the page shell, header, controls, and content viewport mounted while
data loads.

Use these loading treatments:

- Route or module has not mounted yet: render the route/module skeleton.
- Existing tool is switching records or refreshing one content region: keep that region's container
  mounted and show the shared spinner in nearby chrome.
- Repeated rows or cards are loading: use skeleton rows/cards only if their size, alignment, and
  density match the final rows/cards.
- Small framed status cell is loading: text such as "Loading..." is acceptable only when the final
  UI is also a short text value in the same spot.

Use `animate-float-up` only when new content appears for the first time. If optimistic, cached, or
previous-route content is already visible and the app is only reconciling it to server data, do not
run the entrance animation again.

Tables should be quiet:

- Sentence-case headers, never uppercase.
- Horizontal dividers only.
- Compact mono metadata for timestamps and durations.
- Short timestamps in rows, with full values in tooltips or titles when useful.
- Small status badges.

## Do's and Don'ts

Do:

- Use `global.css` tokens and Tailwind token names derived from them.
- Use COSS UI/Base UI primitives from `components/ui`.
- Change shared primitives when multiple screens need the same visual correction.
- Keep settings row descriptions to one short line; rewrite the copy rather than letting it wrap.
- Prefer `text-sm` and `text-meta` over a mix of `text-xs` and `text-sm`.
- Treat `text-sm`, not `text-base`, as Tavern's normal body text.
- Use subtle filled controls inside cards to avoid border-in-border UI.
- Keep icons large enough to read and consistent with text color.
- Verify visual changes in both light and dark mode when they touch primitives or tokens.

Don't:

- Add new shadcn or Radix UI dependencies.
- Hardcode colors in feature components when a semantic token exists.
- Create one-off local controls instead of improving `components/ui`.
- Nest cards inside cards.
- Use strong shadows in light mode.
- Use outline buttons as the default secondary action style.
- Add long explanatory copy inside dense settings rows.
- Use uppercase table headings.
- Use `text-base` as default body text just because browser or library defaults are 16px.
- Use `text-xs` for normal row content, settings copy, or table metadata.
- Add arbitrary font-size classes when a scale token would work.
