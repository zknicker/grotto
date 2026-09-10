# Haus visuals — design system

Everything you render — inline visuals and artifact pages — wears the app's
theme. Almost every decision below is already a token; spend the tokens
instead of inventing values and the output is native in both schemes for free.

## Philosophy

- **Seamless** — a visual is part of the app, not a slide dropped into it.
- **Flat** — hairlines and fills carry structure; no shadows, gradients,
  glass, glow, or decorative fills.
- **Compact** — app density, not deck density.
- **Ink over hue** — `--foreground` and gray do the work; color is reserved
  for meaning (status, series, one emphasis), never for "this is a UI".
- **Sentence case, two weights** — 400 and 500. Never Title Case, ALL CAPS,
  600, or 700.
- **One idea per visual** — a second legend means a second visual.

## Tokens

The frame preloads these on `:root`. Never hardcode a color, font stack,
radius, or spacing value, and never write `prefers-color-scheme` — the host
injects the active theme.

| Token | Role |
| --- | --- |
| `--font-sans` | All UI, body, display values, and SVG text |
| `--font-mono` | Code, hashes, ids, logs — small and secondary only |
| `--app-ui-font-size` | Body size, already set on the frame body |
| `--background` | The page ground. Artifact pages only |
| `--surface` | Card, tile, panel fill |
| `--surface-secondary` | A plate nested on a surface |
| `--surface-tertiary` | A plate nested on that |
| `--foreground` | Primary text, values, active states |
| `--muted-foreground` | Labels, captions, secondary rows |
| `--foreground-tertiary` | Disabled and de-emphasized text |
| `--border` | Hairline: card edges, table rows, separators |
| `--border-strong` | A line that must carry weight: connectors, diagram edges |
| `--accent` | The app's accent: a highlighted border, a badge, one moment |
| `--accent-bg` | The accent as a tint |
| `--accent-foreground` | Text on `--accent-bg` |
| `--success` `--warning` `--error` | Status marks, dots, strokes |
| `--success-bg` `--warning-bg` `--error-bg` | Status chips and callout tints |
| `--success-foreground` `--warning-foreground` `--error-foreground` | Text on the matching tint |
| `--chart-1` … `--chart-5` | Series marks: sky, red, emerald, violet, stone |
| `--chart-grid` | Gridlines and baselines |
| `--chart-label` | Axis and tick text |
| `--radius` | Controls, chips, inputs, nested plates |
| `--radius-card` | Cards, tiles, panels — the app's shell corner |
| `--pad-sm` `--pad-md` `--pad-lg` | Padding inside a plate, card, section |
| `--gap-xs` `--gap-sm` `--gap-md` `--gap-lg` | Gaps between elements, tiles, sections |

`--accent` is emphasis, not interactivity: training data associates blue with
"clickable", Haus does not. Controls, hover, and active states stay ink.

## Layout

- **Card, tile, panel** — `--surface`, 1px `--border`, `--radius-card`,
  `--pad-md`.
- **Tile row** — a grid with `gap: var(--gap-sm)`; at most 5 tiles per row.
- **Nested plate** — `--surface-secondary` and `--radius`; a plate on a plate
  goes `--surface-tertiary`. Three levels of nesting is the ceiling.
- **Chip, badge, pill** — a status or accent `-bg` tint with the matching
  `-foreground` text, `--radius`. Never bare colored text, never a solid fill.
- **Sections** — `--gap-lg` between, `--gap-sm` within.
- Width `100%`; no nested scrolling and no reserved empty space.

## Native elements

In a `visual` fence the frame already styles bare `input`, `select`,
`textarea`, `button`, `input[type=range]`, and `table` to match the app, sets
`accent-color`, and wraps a wide table in its own scroller. Write the bare tag
and add inline style only to change width or alignment — a hand-built control
looks alien beside the real ones.

## Typography

The base body size is **14px** (`var(--app-ui-font-size)`, line-height 1.5) —
the frame sets it on `body`, so plain text is already right.

- Body text: 14px, line-height 1.5. Emphasized body: 14px weight 500.
- Title / section labels: 15–16px, weight 500.
- Secondary text, dense table cells, and code: 12–13px.
- Metadata and compact labels: 11–12px. No font-size below 11px.
- Display values: 24–36px, weight 500, line-height at least 1.08 so glyphs
  don't crop; never past 42px in a visual.
- Numbers use `font-variant-numeric: tabular-nums`, never a switch to mono.
  Letter spacing 0 or positive; names go in `code style`, not bold.
- In inline SVG, set `svg text { font-family: var(--font-sans) }`.

### Text fitting

Font metrics vary by platform. Before putting text in a fixed box or SVG,
check it fits: `chars × budget + 2 × padding ≤ box width`.

| Font size | Budget per character |
| --- | --- |
| 11px | ~5.8px |
| 12px | ~6.3px |
| 14px | ~7.3px |
| 16px | ~8.4px |
| 20px | ~10.5px |

If it doesn't fit: shorten the label, drop a size, or widen the box. Keep 4px
minimum between text and any container edge.

## Charts

Lead with the answer: a headline number or one-line takeaway above the chart
beats a caption below, and the notable point gets annotated on the chart
itself rather than described in prose.

**Marks**

- Bars: at most 24px thick, rounded at the data end only — the baseline stays
  square (draw the path, or `rx` on a rect that extends past the axis).
- Lines: 2px, round joins; no fill underneath unless the area is the point.
- Gridlines: horizontal hairlines in `--chart-grid` only — no vertical lines,
  axis box, or plot border.
- One y-axis, starting at zero. Ticks and axis text in `--chart-label`, 11–12px.
- Legend: 10px squares at `--radius` beside `--muted-foreground` text; skip it
  for a single series.
- Text never wears the series color.

**Color**

Sequential is the default: one hue in opacity steps via
`color-mix(in srgb, var(--chart-1) 45%, transparent)`. Categorical
(`--chart-1` through `--chart-4`, in order) is for genuinely independent
series, 5 hues maximum; past that use line style, not more color. To emphasize
one value, keep it at full hue and drop the rest — to a tint of the same hue,
or to `--chart-5`, the neutral that also draws baselines, targets, and "no
data". Never pair `--chart-2` with `--chart-3` (red with green) in one chart.

Before closing an `<svg>`: the bottom-most `y + height` plus descenders
(~0.25em) clears the viewBox by 8px, nothing exceeds its width, an 8px gutter
separates marks from labels (rightmost get `text-anchor="end"`), and
connectors stop at box edges computed against the border, not the center.

Inline SVG is the default: crisp, script-free, and it streams. Chart.js is the
one allowed external — pinned to
`https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js`, any other
URL blocked — for hover tooltips, many series, or scales that are real work by
hand, and only inside a `visual` fence.

## Fragments

Copy these and change the data. They are the house style.

### KPI row

```
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--gap-sm)">
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:var(--pad-md)">
    <div style="font-size:12px;color:var(--muted-foreground)">Revenue</div>
    <div style="margin-top:2px;font-size:26px;font-weight:500;line-height:1.15;font-variant-numeric:tabular-nums">$102,676</div>
    <span style="display:inline-block;margin-top:var(--gap-xs);padding:1px 8px;border-radius:var(--radius);font-size:12px;background:var(--success-bg);color:var(--success-foreground)">↑ 12.8%</span>
  </div>
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:var(--pad-md)">
    <div style="font-size:12px;color:var(--muted-foreground)">Churn</div>
    <div style="margin-top:2px;font-size:26px;font-weight:500;line-height:1.15;font-variant-numeric:tabular-nums">2.4%</div>
    <span style="display:inline-block;margin-top:var(--gap-xs);padding:1px 8px;border-radius:var(--radius);font-size:12px;background:var(--error-bg);color:var(--error-foreground)">↑ 0.3 pts</span>
  </div>
</div>
```

### Bar chart

```
<h2 style="margin:0 0 2px;font-size:15px;font-weight:500">Weekly sales</h2>
<p style="margin:0 0 var(--gap-sm);color:var(--muted-foreground)">Wednesday carried the week.</p>
<svg viewBox="0 0 640 232" width="100%" role="img" aria-label="Weekly sales, peaking Wednesday at 128">
  <line x1="0" y1="184" x2="640" y2="184" stroke="var(--chart-grid)"/>
  <line x1="0" y1="112" x2="640" y2="112" stroke="var(--chart-grid)"/>
  <line x1="0" y1="40" x2="640" y2="40" stroke="var(--chart-grid)"/>
  <path d="M34 104a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v80h-24z" fill="color-mix(in srgb, var(--chart-1) 45%, transparent)"/>
  <path d="M125 120a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v64h-24z" fill="color-mix(in srgb, var(--chart-1) 45%, transparent)"/>
  <path d="M217 68a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v116h-24z" fill="var(--chart-1)"/>
  <path d="M308 100a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v84h-24z" fill="color-mix(in srgb, var(--chart-1) 45%, transparent)"/>
  <path d="M399 84a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v100h-24z" fill="color-mix(in srgb, var(--chart-1) 45%, transparent)"/>
  <path d="M491 144a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v40h-24z" fill="color-mix(in srgb, var(--chart-1) 45%, transparent)"/>
  <path d="M582 148a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v36h-24z" fill="color-mix(in srgb, var(--chart-1) 45%, transparent)"/>
  <text x="229" y="56" text-anchor="middle" font-size="12" fill="var(--foreground)">128</text>
  <text x="46" y="204" text-anchor="middle" font-size="12" fill="var(--chart-label)">Mon</text>
  <text x="137" y="204" text-anchor="middle" font-size="12" fill="var(--chart-label)">Tue</text>
  <text x="229" y="204" text-anchor="middle" font-size="12" fill="var(--chart-label)">Wed</text>
  <text x="320" y="204" text-anchor="middle" font-size="12" fill="var(--chart-label)">Thu</text>
  <text x="411" y="204" text-anchor="middle" font-size="12" fill="var(--chart-label)">Fri</text>
  <text x="503" y="204" text-anchor="middle" font-size="12" fill="var(--chart-label)">Sat</text>
  <text x="594" y="204" text-anchor="middle" font-size="12" fill="var(--chart-label)">Sun</text>
</svg>
```

### Comparison cards

```
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--gap-sm)">
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-card);padding:var(--pad-md)">
    <div style="font-size:15px;font-weight:500">Starter</div>
    <div style="margin-top:2px;color:var(--muted-foreground)">$0 · 1 seat · community support</div>
  </div>
  <div style="background:var(--surface);border:2px solid var(--accent);border-radius:var(--radius-card);padding:calc(var(--pad-md) - 1px)">
    <div style="display:flex;align-items:center;gap:var(--gap-xs)">
      <span style="font-size:15px;font-weight:500">Team</span>
      <span style="padding:1px 6px;border-radius:var(--radius);font-size:11px;background:var(--accent-bg);color:var(--accent-foreground)">Recommended</span>
    </div>
    <div style="margin-top:2px;color:var(--muted-foreground)">$24 · 5 seats · shared workspaces</div>
  </div>
</div>
```

### Pipeline

```
<div style="display:flex;align-items:center;gap:var(--gap-xs)">
  <div style="background:var(--surface-secondary);border-radius:var(--radius);padding:var(--pad-sm)">
    <div style="font-weight:500">Build</div>
    <div style="font-size:12px;color:var(--muted-foreground)">2m 10s</div>
  </div>
  <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
    <path d="M0 6h22m-5-5 5 5-5 5" fill="none" stroke="var(--border-strong)" stroke-width="1.5"/>
  </svg>
  <div style="background:var(--accent-bg);border-radius:var(--radius);padding:var(--pad-sm);color:var(--accent-foreground)">
    <div style="font-weight:500">Test</div>
    <div style="font-size:12px">Running · 41 of 88</div>
  </div>
  <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
    <path d="M0 6h22m-5-5 5 5-5 5" fill="none" stroke="var(--border-strong)" stroke-width="1.5"/>
  </svg>
  <div style="background:var(--surface-secondary);border-radius:var(--radius);padding:var(--pad-sm)">
    <div style="font-weight:500">Deploy</div>
    <div style="font-size:12px;color:var(--muted-foreground)">Queued</div>
  </div>
</div>
```

Flow left-to-right for pipelines, top-to-bottom for hierarchies. Highlight at
most one node. Past 9 nodes, group into labeled clusters.

### Table

```
<table>
  <caption>Spend by channel, June 2026</caption>
  <thead><tr><th>Channel</th><th style="text-align:right">Spend</th><th style="text-align:right">ROAS</th></tr></thead>
  <tbody>
    <tr><td>Search</td><td style="text-align:right">$42,300</td><td style="text-align:right">3.1×</td></tr>
    <tr><td>Social</td><td style="text-align:right">$18,900</td><td style="text-align:right">2.4×</td></tr>
  </tbody>
</table>
```

## Icons

Read [icons.md](icons.md), search `references/icons/manifest.json`, and inline
the SVG from `assets/icons/` with `currentColor`. A 16–18px leading icon beside
a title reads as native app chrome; 24px is the hard ceiling, and a spot that
wants a bigger glyph wants typography instead.

## Streaming order

Scripts run only once the markup is complete: static HTML/SVG with inline
`style="..."` first, then inlined data, then `<script>` last, never
referencing elements below it. Keep any `<style>` block under ~15 lines, skip
comments, and in SVG put `<defs>` before the marks.

## Artifact pages

Full self-contained HTML pages follow everything above, but get only the
tokens — not the frame's base styles — so they style their own elements:

- The page owns its ground: `--background` on the body, `--surface` panels,
  `--surface-secondary` nested. The only surface where you set a background.
- Assume it renders offline from a snapshot: `data:` URIs for small images,
  charts as inline SVG, nothing fetched.
- Prose column ~48rem; tables and dashboards may go full width. One
  `<h1>`-level title, then sentence-case section titles at 15–16px weight 500.
- Operational, not editorial: dense sections, hairline dividers, right-aligned
  numbers, mono for timestamps and ids.

```
<!doctype html>
<html><head><meta charset="utf-8"><title>June campaign report</title>
<style>
  body { margin:0; background:var(--background); color:var(--foreground);
    font-family:var(--font-sans); font-size:var(--app-ui-font-size,14px); line-height:1.5; }
  main { max-width:48rem; margin:0 auto; padding:var(--pad-lg); }
  section { margin-bottom:var(--gap-lg); }
  h1 { font-size:20px; font-weight:500; margin:0 0 4px; }
  h2 { font-size:15px; font-weight:500; margin:0 0 var(--gap-sm); }
  .muted { color:var(--muted-foreground); }
  table { width:100%; border-collapse:collapse; }
  td, th { padding:8px 12px; border-bottom:1px solid var(--border); text-align:left; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
</style></head>
<body><main>
  <h1>June campaign report</h1>
  <p class="muted">Summer glow '26 · Jun 1–30</p>
  <section>...</section>
</main></body></html>
```

## Accessibility

- A chart `<svg>` gets `role="img"` and an `aria-label` stating the takeaway,
  not the chart type. Decorative SVG gets `aria-hidden="true"`, and icon-only
  controls get an `aria-label`.
- Status is never color alone — pair the tint with a label, glyph, or value,
  and use the paired `-foreground` token on every tint.
