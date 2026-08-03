---
summary: Tavern component kit reference for the shared presentational library behind widgets and dashboards.
read_when:
  - adding or changing shared inline-UI components such as cards, charts, tables, or calendar cards
  - building a widget renderer or dashboard tile on kit components
  - deciding whether presentation code belongs in the kit or in a widget wrapper
---

# Component Kit

`apps/website/src/kit/` is the Tavern component kit: the single presentational
library behind every app-internal inline-UI surface. Catalog widget renderers,
plugin widget renderers, and the dashboard grid compose these components. The
kit owns the "make it look nice" problem — axes, ticks, tooltips, chart
composition, calendar cards, tables, cards, empty states, tokens, dark mode,
responsive width — solved once, consumed everywhere. Agent artifacts do not
consume the kit: they are self-contained HTML themed via injected tokens (see
[artifacts.md](artifacts.md)).

`src/kit/index.ts` is the public entrypoint and the module's contract. The
vocabulary is bare nouns that read as a small design system and can be guessed
cold by an author who has only seen a short reference:

```tsx
<Card size="full" title="Quarterly Revenue">
    <BarChart data={points} series={[{ key: 'revenue', label: 'Revenue' }]} xKey="quarter" />
</Card>
```

## Rules

- Kit components are props-in/render-out. No data fetching, no tRPC, no hooks
  from `src/hooks`, no app or runtime state.
- Colors come from `src/styles/global.css` tokens only (directly or via
  `chartStyleVars`, which every kit chart scopes onto its own root), so every
  component is theme-clean in light and dark.
- No `Widget` prefix in the kit. The renderers that sit above it live with
  their features (`features/chats/visual-card.tsx`,
  `features/chats/artifact-card.tsx`); shared frame plumbing is in
  `src/agent-html/`.
- Kit prop types are kit-local. Widget fence schemas in `@tavern/api` are one
  consumer whose parsed props structurally satisfy kit props; the kit does not
  import the fence contract.
- Charts come from HeroUI Pro (`BarChart`, `LineChart`, `AreaChart`, …,
  with `ChartTooltip`), which wraps Recharts and themes axes, grid, and
  tooltip from HeroUI tokens. The visx-based chart engine that used to live
  under `src/components/charts/` was deleted in phase 7 — 75 files for one
  chart — along with its eight `@visx/*` dependencies.

## Components

| Export | Role |
| --- | --- |
| `Card` | Titled framed surface: optional header title + action, elevated rounded body, `compact`/`full` width. |
| `Table` | Bordered data table with per-column `align` and Yes/No boolean formatting. Props: `columns`, `rows`. |
| `CalendarEvent` | Single-event card with a date tile and time range label. |
| `CalendarDay` | Day agenda card: date tile, timezone label, event cards, empty state. |
| `DateRangePicker` | Popover date-range picker with presets (7d/14d/30d/month). |

Also exported: `chartStyleVars` (the chart token mapping), chart prop types
(`ChartSeries`, `ChartDatum`, ...), and ISO date helpers (`formatIsoDate`,
`parseIsoDate`, `shiftIsoDate`, ...).

Layout components (`Stack`, `Grid`, `Row`) and stat/empty containers are
reserved vocabulary for the dashboard grid; add them
with those features, not speculatively.

## Consumers

Renderers for agent-authored HTML live with their features and share the
frame plumbing in `src/agent-html/` (one token list, one sandbox constant).
Fence-specific concerns — fallback rows, workspace file queries — stay outside
the kit. See [widgets.md](widgets.md) for the fence contract and
[frontend.md](frontend.md) for folder ownership.

The kit is app-internal only. Agent artifacts render as self-contained HTML
with the `src/styles/artifact-tokens.css` vocabulary injected into their sandboxed frame
— they share Tavern's theme through tokens, never through kit code (see
[artifacts.md](artifacts.md)).
