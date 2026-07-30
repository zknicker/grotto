# Tavern visuals — design system

The full visual style for everything you render: visual rules, typography,
component patterns, the runtime token map, and the application checklist.
Read this before writing visual or page code unless the user already fixed
the visual decisions for you. Sections 1–3 and the checklist are the core
style; sections 4–6 carry Tavern-specific construction guidance for charts,
diagrams, and artifact pages.

---

## 1. Visual rules

### Core rule

Black and white are the primary colors: `--foreground` ink on the host
surface. Gray is the neutral support system for hierarchy, separators,
disabled states, metadata, hover/active tints, and subtle borders. Accent
colors come only from the runtime tokens (never invented) and are the last
resort — use them only after black, white, and gray are insufficient to
express required differences such as status, priority, chart series,
file/category markers, or progress groups.

Interaction emphasis is dark, not blue: focus rings, hover states, selected
items, active tabs, and primary buttons use `--foreground` and gray tints.
`--brand` is reserved for true semantic emphasis — one deliberate moment at
most — never for generic "this is interactive" styling. Training data
associates blue with interactive; Tavern does not.

Do not set a page, body, canvas, card, or panel base background color in an
inline visual. Preserve the existing background, or use `transparent` /
`inherit`; the host provides the background. (Full artifact pages own their
ground — see section 6.)

### Visual discipline

- Do not prescribe a visible base fill. No default page, card, panel, or
  canvas background.
- UI chrome is black/white first: primary text, key values, active states,
  primary controls, high-emphasis icons.
- Use gray only for hierarchy and structure: secondary/tertiary text,
  borders, separators, disabled states, hover/active tints.
- Use accent colors only for multi-color semantics: status (`--error`,
  `--success`, `--warning`, `--info`), priority dots, chart series
  (`--chart-1..5`), tags, category chips, progress fills. For
  tag/chip/status backgrounds, tint the token to 10–25% — the provided
  `-bg` variants (`--success-bg`, `--warning-bg`, `--error-bg`,
  `--info-bg`) or `color-mix(in srgb, var(--error) 12%, transparent)` —
  instead of a solid fill. Never use any accent as a dominant fill, page
  tint, or background theme.
- Avoid colorful gradients. If a gradient is necessary for a data mark, keep
  it subtle and within one hue family (opacity steps of a single token, not
  hue blends).
- Avoid decorative base fills, gradient orbs, bokeh, heavy color washes,
  nested decorative cards, marketing-page hero treatment, heavy shadows,
  blur, and glassmorphism. Keep surfaces clean/flat.
- Use fine borders and compact radii: 1px `var(--border)` separators
  (`var(--border-strong)` when the line must carry weight),
  `var(--radius-sm)` chips, `var(--radius-md)` icon buttons and controls,
  `var(--radius-lg)` list cards/inputs, `var(--radius-xl)` elevated panels.

### Chart colors

Color explains data, not decorates it. Sequential is the default;
categorical is the exception; diverging is the last resort. Derive every
chart color from the runtime tokens.

- **Categorical** (truly independent series), in this order: `--chart-1`
  (blue) → `--chart-2` (red) → `--chart-3` (green) → `--chart-4` (purple) →
  `--chart-5` (neutral gray). Maximum 5 hues; beyond that differentiate with
  line style (solid / dashed / dotted), not new colors.
- **Comparable series** (same metric across categories — revenue by region,
  temperature by city): same-hue opacity instead of categorical. Steps
  100 / 70 / 50 / 40 / 25% via
  `color-mix(in srgb, var(--chart-1) 70%, transparent)`.
- **Positive vs baseline** (actual vs target): blue vs neutral gray.
  **Positive vs negative** (profit/loss, risk): blue vs red. **Deviation
  from a true midpoint**: red ↔ neutral ↔ blue diverging — only when a real
  zero/break-even center exists.
- Baseline, reference lines, grid, and "no data" use
  `--foreground-quaternary` (or the derived `--chart-grid`).
- Heatmaps and stacked areas are always sequential, never categorical.
  Pie/donut prefers blue sequential — slices are parts of one whole; use
  categorical only for independent competitors.
- Colorblind safety: never pair green with red in one chart (`--chart-3`
  with `--chart-2`, or `--success` with `--error`); colors must stay
  distinguishable in grayscale; never rely on color alone — add labels or
  patterns.
- Text never wears the series color: labels, values, and legend text are
  `--foreground` or `--muted-foreground`; only marks (bars, lines, dots,
  swatches) carry `--chart-N`.

---

## 2. Typography

Use the host fonts, not artifact-specific or presentation fonts.

- UI/body must use `font-family: var(--font-sans)`.
- Every HTML output starts with a local font reset: set the root wrapper to
  `font-family: var(--font-sans)`, set
  `button, input, select, textarea { font: inherit; }`, and set
  `svg text { font-family: var(--font-sans); }` when using inline SVG text.
- Primary display values must use `var(--font-sans)`, including timers,
  prices, counts, percentages, dates, times, counters, and chart labels.
- For numeric display values, use
  `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`
  instead of switching to a mono font.
- Reserve `var(--font-mono)` for code, hashes, raw identifiers, logs,
  timestamps, and genuinely technical monospace tables only. Keep mono
  small and secondary; never use mono for large hero metrics, timers,
  counters, prices, percentages, or slider values.
- Do not hardcode font stacks (`Inter`, `Geist`, `SF Pro Text`,
  `system-ui`, `Poppins`, `JetBrains Mono`). Do not introduce decorative
  display fonts. If a fallback is required, keep it inside the variable
  fallback: `font-family: var(--font-sans, sans-serif)`.

### Scale

The base body size is **14px** (`var(--app-ui-font-size)`, line-height
1.5) — the frame sets this on `body`, so plain text is already correct;
don't resize it.

- Body text: 14px, line-height 1.5. Emphasized body: 14px weight 500.
- Title / section labels: 15–16px, weight 500.
- Secondary text and dense table cells: 12–13px.
- Metadata and compact labels: 11–12px. No font-size below 11px.
- Primary display values: usually 24–36px, never larger than 42px in a
  compact visual; weight 500, line-height at least 1.08 so glyphs don't
  crop.
- Letter spacing must be 0 or positive — never negative.
- **Two weights only**: 400 regular and 500 bold. Avoid 600/700 — they look
  heavy against the host.
- **Sentence case always** — never Title Case or ALL CAPS, including SVG
  text labels, table headers, and headings.
- No mid-sentence bolding. Entity, class, and function names go in
  `code style`, not bold.

### Text fitting (SVG and fixed boxes)

Geist averages ~0.52em per character. Before putting text in a box or SVG,
check it fits:

| Font size | Budget per character |
| --- | --- |
| 11px | ~5.8px |
| 12px | ~6.3px |
| 14px | ~7.3px |
| 16px | ~8.4px |
| 20px | ~10.5px |

A label fits when `chars × budget + 2 × padding ≤ box width`. If it does
not fit: shorten the label, drop to the next size, or widen the box — never
let text overflow or touch a box edge. Keep at least 4px between any text
and its container edge.

---

## 3. Components, motion & layout

### Controls & icons

- Native controls (sliders, switches, checkboxes, radios, progress bars)
  are UI chrome, not data accents. Keep them neutral:
  `accent-color: var(--foreground)` or gray border/surface tokens. Do not
  use browser default blue or a brand accent for generic controls — only
  when the control itself is a semantic accent/state selector.
- **Destructive and secondary row actions are hover-revealed, not always
  visible.** Delete, remove, clear, and similar per-item actions on list
  rows, cards, chips, and table rows stay hidden by default and appear on
  the parent's `:hover` (or `:focus-within` for keyboard users):

  ```css
  .row .row-actions { opacity: 0; transition: opacity var(--t-fast) var(--ease-out); }
  .row:hover .row-actions, .row:focus-within .row-actions { opacity: 1; }
  ```

  Use `opacity`/`visibility`, not `display: none`, so the layout doesn't
  shift and the control stays keyboard-reachable. A permanently visible
  delete button on every row reads as noisy and dangerous. Exception: a
  single, deliberate destructive action that is the output's point (e.g. a
  confirm dialog's "Delete" button) stays visible.
- Icons: prefer the shipped icon library — read [icons.md](icons.md) and
  pick from `references/icons/manifest.json`, then inline the SVG from
  `assets/icons/` with `currentColor`. A small leading icon (16–18px)
  beside a dashboard title or section header is welcome and reads as
  native app chrome. Only build a custom icon (same solid rounded style,
  24×24 grid) when no library icon matches. Do not import, link, or fetch
  external icon assets. Do not use emoji as UI icons. **24px is the
  maximum icon size** — if a spot seems to need a larger icon (empty
  state, hero mark, big decorative glyph), don't use an icon there at all;
  solve it with typography or layout.

### Spacing & radius

All spacing snaps to the token scale: **4 / 8 / 12 / 16 / 20 / 24 / 32px**.
No values off the scale — `7px`, `13px`, `17px` read as accidents, not
decisions. When a gap needs to sit between two steps, pick the smaller one;
visuals are compact surfaces.

All radii come from the radius tokens: `var(--radius-sm)` chips,
`var(--radius-md)` icon buttons and controls, `var(--radius-lg)` list
cards/inputs, `var(--radius-xl)` elevated panels, `9999px` for
pills/avatars only.

**Nested radii: outer is always larger than inner.** When a rounded element
sits inside another rounded container, the inner radius must be smaller —
compute it as `inner = outer − padding` (e.g. a 12px panel with 8px padding
holds 4px-radius children), and never let it go below 4px or above the
container's radius. Equal radii inside each other, or an inner element
rounder than its container, read as broken corners. Concentric corners are
the check: the two curves should share a center.

### Complexity budgets

Hard ceilings; past them, split the output or simplify:

- ≤ 5 hues per output (then line styles, not colors).
- ≤ 5 stat tiles or boxes per row; ≤ 9 nodes per diagram before clustering.
- ≤ 3 levels of visual nesting (container → card → element).
- Subtitles and captions ≤ 12 words.
- One idea per visual. If a second idea needs its own legend, it needs its
  own visual.

### Animation & layout

- Use small CSS transitions or inline JavaScript with native browser APIs
  only. No Motion, GSAP, React, Vue, npm packages, CDN scripts, or external
  modules. Keep motion purposeful and short; avoid loops that don't
  communicate progress or state. Use the shared motion tokens instead of
  arbitrary values: durations `--t-micro` / `--t-fast` / `--t-normal` /
  `--t-slow` (80–300ms), easings `--ease-out` / `--ease-in` /
  `--ease-standard`.
- Responsive, natural width `100%`; the host card fills the content column.
  No `position: fixed` — everything stays in normal document flow. Avoid
  nested scrolling; let height follow content, don't reserve empty vertical
  space. Keep text readable in both light and dark mode — automatic when
  every color is a token.

### Streaming-friendly authoring order

Output streams token by token; scripts run only after markup is complete.
Structure code so useful content appears early:

1. `<style>` (short) and static HTML/SVG that looks useful immediately.
2. Local data inlined into the HTML.
3. `<script>` last for interactivity. Never reference elements below a
   script.

Prefer inline `style="..."` over `<style>` blocks so controls look correct
mid-stream. Keep `<style>` short (~15 lines). No `<!-- comments -->` or
`/* comments */` (waste tokens, hurt streaming). For SVG, put `<defs>`
(markers) first, then visual elements immediately. Use solid flat fills —
gradients, shadows, and blur flash during streaming DOM diffs.

---

## 4. Charts in practice

### Construction

- Prefer inline SVG: crisp, script-free, streams progressively. Simple
  bars, lines, sparklines, donuts, gauges, and stat rows never need a
  library.
- Chart.js is the one allowed external, pinned:
  `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"></script>`
  (any other URL is blocked). Use it only for hover tooltips, many series,
  or scales that are real work by hand — and expect it to render only when
  the script loads at the end.
- Lead with the answer: a headline number or one-line takeaway above the
  chart beats a caption below. Numbers are tabular with compact units
  (1.2k, $4.5M).
- When the data has a story, annotate its most notable point — a labeled
  peak, dip, or event marker on the chart itself beats prose about it.
- Gridlines: horizontal only, 1px, `var(--chart-grid)`. No vertical
  gridlines, no axis boxes. Axis labels and ticks: `var(--chart-label)` or
  `--muted-foreground`, 11–12px. Start value axes at zero unless the data
  genuinely demands otherwise.
- Legend: small swatch (10px, radius 2px) + muted text, above or below the
  plot; a one-line muted caption ("bar = spend · label = ROAS per channel")
  works well for compact composed charts. Skip the legend for a single
  series.
- Stat tiles: label (12px muted) → value (24–32px, weight 500, tabular) →
  delta as a tinted pill chip (`--success-bg`/`--error-bg` with the
  matching `-foreground` text), never bare colored text.
- Assign series colors once and keep them stable across a conversation:
  first series `--chart-1`, comparison `--chart-2`, and so on. A
  single-metric chart uses `--chart-1`.

### viewBox safety checklist

Before closing an `<svg>`:

1. The bottom-most element's `y + height` (plus text descenders, ~0.25em)
   is at least 8px above the viewBox height.
2. No element's x-extent exceeds the viewBox width; rightmost labels get
   `text-anchor="end"` or explicit width checks (section 2, Text fitting).
3. Bars and marks never overlap axis labels; keep an 8px gutter between the
   plot area and any label block.
4. Connector lines stop at component edges — compute endpoints against the
   box border, never the box center, so lines don't pierce boxes.

### Golden example — bar chart

```
<h2 style="margin:0 0 4px;font-size:15px;font-weight:500">Weekly sales</h2>
<p style="margin:0 0 12px;color:var(--muted-foreground)">Up 18% over last week.</p>
<svg viewBox="0 0 640 232" width="100%" role="img" aria-label="Weekly sales bar chart">
  <line x1="0" y1="184" x2="640" y2="184" stroke="var(--chart-grid)"/>
  <line x1="0" y1="112" x2="640" y2="112" stroke="var(--chart-grid)"/>
  <line x1="0" y1="40" x2="640" y2="40" stroke="var(--chart-grid)"/>
  <rect x="24" y="64" width="48" height="120" rx="3" fill="var(--chart-1)"/>
  <rect x="112" y="96" width="48" height="88" rx="3" fill="var(--chart-1)"/>
  <text x="48" y="52" text-anchor="middle" font-size="12" fill="var(--foreground)">86</text>
  <text x="136" y="84" text-anchor="middle" font-size="12" fill="var(--foreground)">63</text>
  <text x="48" y="204" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">Mon</text>
  <text x="136" y="204" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">Tue</text>
</svg>
```

### Tables

Render tabular data as a plain HTML `<table>` — the visual frame styles
bare tables natively (app-matched row hairlines, 500-weight headers, muted
cells, hover tint), so add no table CSS of your own in a visual. Right-align
numeric columns with `style="text-align:right"` and keep values
`tabular-nums`. Sentence-case headers; a `<caption>` renders as a muted
line below the table. Artifact pages style their own tables (see the golden
page skeleton).

### Golden example — stat tile

```
<div style="flex:1;padding:12px 16px;border:1px solid var(--border);border-radius:var(--radius-lg)">
  <div style="font-size:12px;color:var(--muted-foreground)">Revenue</div>
  <div style="font-size:26px;font-weight:500;font-variant-numeric:tabular-nums">$102,676</div>
  <span style="display:inline-block;margin-top:4px;padding:1px 8px;border-radius:var(--radius-sm);font-size:12px;background:var(--success-bg);color:var(--success-foreground)">↑ 12.8% vs May</span>
</div>
```

---

## 5. Diagrams in practice

Diagrams are boxes, labels, and connectors drawn with flex/grid for
structure and inline SVG for connectors — no diagram library, no mermaid.

- Nodes: fill `var(--surface-3)`, border 1px `var(--border-strong)`, radius
  `var(--radius-lg)`, text `var(--foreground)`. Secondary text and edge
  labels: `var(--muted-foreground)`, 12px, beside the line — not on colored
  chips.
- Connectors: 1.5px `var(--border-strong)` strokes; arrowheads as small SVG
  markers in the same color. Emphasize at most one path with `--chart-1`.
- Highlight at most one node: `var(--brand-muted)` fill with
  `var(--brand-muted-foreground)` text, or a 1px `var(--brand)` border.
- Status states are semantic only: `--success` / `--warning` / `--error`
  for healthy/degraded/failed — never decoration.
- Keep flow direction consistent: left-to-right for pipelines,
  top-to-bottom for hierarchies. Align nodes to a grid; even gaps
  (12–24px). Prefer 4–9 nodes; past that, group into labeled clusters (a
  bordered container with a 12px muted caption).
- Patterns: pipeline = flex row + SVG arrows; hierarchy = nested flex
  columns or indentation with left borders; sequence = columns with 1px
  lifelines and labeled horizontal arrows; timeline = vertical left border
  with dot markers and dated entries.

### Golden example — pipeline node pair

```
<div style="display:flex;align-items:center;gap:8px">
  <div style="padding:10px 14px;background:var(--surface-3);border:1px solid var(--border-strong);border-radius:var(--radius-lg)">
    <div style="font-weight:500">Build</div>
    <div style="font-size:12px;color:var(--muted-foreground)">2m 10s</div>
  </div>
  <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
    <path d="M0 6h22m-5-5 5 5-5 5" fill="none" stroke="var(--border-strong)" stroke-width="1.5"/>
  </svg>
  <div style="padding:10px 14px;background:var(--surface-3);border:1px solid var(--border-strong);border-radius:var(--radius-lg)">
    <div style="font-weight:500">Test</div>
    <div style="font-size:12px;color:var(--success-foreground)">Passing</div>
  </div>
</div>
```

---

## 6. Artifact pages

Full self-contained HTML pages (artifact pages) follow everything above,
plus:

- Pages own their ground: `background: var(--background)` on the page,
  `var(--card)` panels, `--surface-2..4` for nested elevation. This is the
  one surface where you set a base background.
- One file: inline `<style>` and `<script>`, `data:` URIs for small images.
  No external fonts, scripts, stylesheets, or fetches; assume the page
  renders offline from a snapshot. (The Chart.js pin applies to `visual`
  fences only — pages draw charts as inline SVG.)
- Layout rhythm: compact full-width sections with constrained inner
  content. Prose column ~48rem; tables and dashboards may go full width.
  Vertical rhythm from the spacing scale — more space between sections
  (24–32px) than within them (8–16px); one `<h1>`-level title, then
  sentence-case section titles at 15–16px weight 500.
- Operational, not editorial: dense scannable sections, hairline borders,
  flat fills. Tables: horizontal dividers only, sentence-case headers,
  right-aligned numbers, compact mono for timestamps and ids.
- Semantic HTML with a sensible heading outline; the first heading or
  `<title>` names the page.
- Artifact page files live under `workbench/`.

### Golden page skeleton

```
<!doctype html>
<html><head><meta charset="utf-8"><title>June campaign report</title>
<style>
  body { margin:0; background:var(--background); color:var(--foreground);
    font-family:var(--font-sans); font-size:14px; line-height:1.5; }
  main { max-width:48rem; margin:0 auto; padding:32px 24px; }
  section { margin-bottom:32px; }
  h1 { font-size:20px; font-weight:500; margin:0 0 4px; }
  h2 { font-size:15px; font-weight:500; margin:0 0 12px; }
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

---

## 7. Runtime token mapping

The frame has Tavern's theme pre-loaded. Map the style onto these runtime
variables; prefer runtime variables over hardcoded values.

- Text: `--foreground`, `--muted-foreground`, `--foreground-tertiary`,
  `--foreground-quaternary`
- Surfaces: `--background` (pages only), `--card`, `--surface-2`,
  `--surface-3`, `--surface-4`
- Structure: `--border`, `--border-strong`; form surfaces `--input`, focus
  `--ring` (pages)
- Status: `--success`, `--warning`, `--error`, `--info`, each with
  `-foreground` and `-bg` variants for chips and callouts
- Emphasis (semantic accents only, never generic interaction): `--brand`,
  with `--brand-muted` + `--brand-muted-foreground` for readable tints
- Chart series: `--chart-1` … `--chart-5` (blue, red, green, purple,
  neutral); derived chrome `--chart-grid`, `--chart-label` (visual fences)
- Radii: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`
- Motion: `--t-micro`, `--t-fast`, `--t-normal`, `--t-slow`, `--ease-out`,
  `--ease-in`, `--ease-standard`
- Fonts: `--font-sans`, `--font-mono`; base size `--app-ui-font-size`

Do not use `prefers-color-scheme` or maintain a separate light/dark token
table — the host injects the active theme's values.

---

## 8. Application checklist

1. Preserve the existing background (visuals) or set `--background`
   (pages).
2. Convert main UI color decisions to black/white first; interaction
   emphasis uses `--foreground`, never accent blue.
3. Use gray for hierarchy and structure.
4. Add accent tokens only for required multi-state or multi-category
   distinctions (status, priority, chart series, tags) — tinted 10–25% for
   backgrounds, following the chart color rules for data marks.
5. Replace presentation typography with `var(--font-sans)` /
   `var(--font-mono)`; two weights; sentence case; nothing below 11px.
6. Tighten large decorative spacing into app-like density; every gap and
   padding snaps to the 4 / 8 / 12 / 16 / 20 / 24 / 32 scale, nested radii
   are outer-large-inner-small.
7. Check text fits its boxes (section 2) and the viewBox checklist
   (section 4).
8. Verify no accent color has become a base fill or dominant theme color.
