---
name: visuals
description: >
  Tavern design system for everything you render: inline visuals and artifact
  pages. Read this BEFORE emitting any visual or artifact fence. Defines when
  to render and the fence contracts; the full visual style lives in
  references/design-system.md.
---

# Visuals

Managed by Tavern. Do not edit this skill directory; Tavern refreshes it on
startup.

A visual is a compact visual or interactive surface rendered inline in the
conversation: diagrams, dashboards, tables, calculators, sliders,
comparisons, timelines, state machines, small simulations. Use one when
seeing structure helps the user understand, compare, inspect, or act on the
answer better than prose alone.

You render two kinds of visual output in chat:

- A **visual** — bespoke inline HTML/SVG in a ```` ```visual ```` fence.
- An **artifact** — a durable self-contained HTML page carded in chat and
  opened in the artifact pane, for anything the user will keep or iterate on.

## When to render

- The answer has spatial, sequential, systemic, comparative, numeric, or
  interactive structure.
- The user does not need to say "show", "visualize", "chart", or "widget" —
  proactive visuals are expected when the structure is there.
- If the user gives a compact visual spec without a verb ("REST vs GraphQL
  table", "checkout state machine", "pricing calculator"), render it as a
  visual instead of only describing it.
- Routing: draw a **visual** for anything shown inline — charts, tables,
  diagrams, dashboards, interactive controls. Build an **artifact** for
  deliverables — documents, reports, pages the user will keep. When unsure,
  use plain text.
- Render tabular data as a plain HTML `<table>` inside a visual, never as a
  Markdown table — the frame styles bare tables natively (see
  design-system.md, Tables).
- Do **not** render a visual for: ordinary prose answers, routine
  line-by-line code explanations, file lists / galleries / final file
  deliverables, blocking input workflows, destructive or native actions, or
  large long-lived apps.

## Fence contracts

A visual is a fenced block whose language is `visual`; the body is raw
HTML/SVG; optional text after `visual` on the fence line becomes the title:

````
```visual Weekly sales
<h2>Weekly sales</h2>
<svg viewBox="0 0 640 220">...</svg>
```
````

An artifact is a self-contained `.html` file (inline CSS/JS, no external
assets) written under `workbench/`, then referenced with a bare `artifact`
fence containing exactly one JSON object — no comments, no trailing commas:

````
```artifact
{"path":"workbench/report.html","title":"June report"}
```
````

Rules:

- Tavern strips fences from your visible reply and renders them in place.
- Raw HTML belongs only in a `visual` fence body or an artifact file. Never
  output HTML, JSX, CSS, imports, or class names in plain reply text.
- Text goes in your reply, visuals go in the fence. Do not repeat identical
  content in prose and in a fence; prose adds context, never restates.
- After a visual renders, don't narrate it. Say only what the visual cannot.
- Multiple fences in one reply are allowed when the answer has clearly
  separate visual parts; prefer one.

## Visual runtime contract

- The `visual` fence body renders in a sandboxed iframe with Tavern's theme
  tokens preloaded as CSS variables. Content width is about 700px; the body
  has 16px padding, the app font, 14px text, a card background, and native
  styling for bare `<table>` markup. Height is measured automatically — let
  the document flow; no fixed heights, no `position: fixed`.
- No network: fetch/XHR, remote images, and fonts are blocked. Embed all
  data inline at generation time. One pinned exception: Chart.js
  (see design-system.md, Charts).
- Allowed: HTML, SVG, CSS, inline JavaScript, native browser APIs. There is
  no host bridge — interactivity works within the iframe over embedded data.
- Never hardcode colors, fonts, or radii — always use `var(--xxx)`.
  Hardcoded values break dark mode and look alien beside the host UI.

## ⚠️ Required: read the design system before you design

**Unless the user has given you very explicit, precise styling instructions
for this specific output, you MUST read
[references/design-system.md](references/design-system.md) before writing
visual or artifact markup.** It carries the full Tavern visual style —
visual rules, typography, component patterns, chart and diagram
construction, page layout, the runtime token map, and the application
checklist. Do not decide an output is too simple, too static, or too small
to need it. Skip it only when the user's instructions already fix the
visual decisions for you.

The skill ships a curated icon library (`assets/icons/`, indexed in
`references/icons/manifest.json`) — read
[references/icons.md](references/icons.md) when an output has icon-shaped
spots: dashboard or section titles, status markers, toolbars, empty states.
Pick from the library and inline the SVG instead of drawing your own or
using emoji.
