---
summary: Visual and artifact architecture — tagged fences, generative visuals in sandboxed iframes, message-backed visual rendering, dormant widget-activity pipeline, legacy catalog replay, and chat rendering.
read_when:
  - changing visual or artifact persistence, fence parsing, or renderer behavior
  - changing the visual sandbox, its CSP or CDN allowlist, or the theme-token injection
  - changing how assistant final replies become app-rendered chat UI
  - touching legacy stored widget activity or its fallback rendering
---

# Agent-authored HTML

Agents write HTML. Grotto hands that HTML one set of CSS variables, and it
renders in one of two places.

| surface | what it is | where it renders | renderer |
| --- | --- | --- | --- |
| Visual | a ```` ```visual ```` fence inside a message | inline in the transcript | `features/chats/visual-card.tsx` |
| Artifact | a durable `.html` file in the workspace | card in chat → artifact side pane | `features/chats/artifact-card.tsx` → `chat-artifact-workspace-preview.tsx` |

Both share `src/agent-html/`: `tokens.ts` is the single published token
list plus the snapshot/injection helpers, and `sandbox.ts` is the single
`sandbox=` capability list. Never add `allow-same-origin` — the opaque origin
is what stops agent HTML reaching app cookies, storage, or DOM.

`features/chats/legacy-widget-row.tsx` replays catalog widgets stored before
the 2026-07 retirement as fallback-text cards; nothing emits new ones.

## The two fence-backed kinds

Agents render exactly two kinds of visual output: **visuals** — bespoke
inline HTML/SVG drawn in a ```` ```visual ```` fence and rendered in a
sandboxed iframe — and **artifacts** — durable self-contained pages carded
in chat and rendered in the artifact pane ([artifacts.md](artifacts.md)).
The old closed widget catalog (tables, charts, calendars, html-preview,
plugin widgets) was retired in 2026-07; stored catalog widgets in historical
chats replay as fallback-text cards.

## Visuals

The assistant draws an inline visual by writing a fenced block whose language
is `visual`; the body is raw model-authored HTML/SVG (no props schema, no
registration), with optional info-string text as the title:

````markdown
```visual Weekly sales
<h2>Weekly sales</h2>
<svg viewBox="0 0 640 220">...</svg>
```
````

- **Fence contract.** Fences parse client-side from the message content in
  document order via `splitVisualFences` (shared grammar in
  `packages/tavern-api/src/widgets/visual/contracts.ts`). Body limit 60k
  chars; an empty body strips as invalid. Fallback text is the info-string
  title, else the document `<title>`, else the first h1-h3.
- **Persistence.** The durable message content IS the visual: the fence stays
  in the message body and the transcript splits it out at render time — there
  is no separate widget-render snapshot. Live and durable replies render
  through the same `splitVisualFences` path, so a visual survives without any
  Runtime projection. Data is embedded at generation time; visuals never fetch
  live app data.
- **Streaming.** While a `visual` fence is open mid-turn, Runtime updates the
  streaming post on a 500ms throttle (`harness-turn-stream.ts`), and the app
  splits fences out of live reply text (`splitVisualFences`) to grow the
  iframe body progressively — the browser's error-tolerant HTML parsing is
  the streaming renderer; srcdoc rewrites are throttled app-side. Malformed
  HTML degrades to whatever the parser can render, never an error state.
- **Sandbox.** Opaque origin, `srcDoc`, scripts allowed, never
  `allow-same-origin`, no browser storage
  (`apps/website/src/features/chats/visual-card.tsx`). A CSP meta locks the document
  down: `default-src 'none'`, inline scripts/styles allowed, `img-src
  data: blob:` only, `connect-src 'none'` (no exfil channel).
- **CDN allowlist.** One pinned external source: Chart.js `4.5.1` via
  jsdelivr (`visualChartJsUrl`). Pinning the exact version in the CSP keeps
  the supply-chain surface a single immutable artifact; a version bump is a
  deliberate change that updates the CSP and the visuals skill together. The
  skill steers toward inline SVG first, so the CDN is an escape hatch for
  genuinely interactive charts, and an offline app degrades to script-less
  markup.
- **Theming.** The iframe cannot read app styles, so the host snapshots a
  curated token list (surfaces, text tiers, borders, status, `--chart-1..5`,
  radii, fonts) from computed styles and injects them as `:root` variables,
  re-snapshotting on theme change (`apps/website/src/agent-html/tokens.ts`).
  Generated visuals reference only those variables — never hardcoded surface
  or text colors — which is what makes them wear Grotto's brand in both
  schemes.
- **Native tables.** The sandbox base stylesheet styles bare `<table>`
  markup to match the app's `ui/table.tsx` look (hairline row dividers,
  muted cells, hover tint, styled `tfoot`/`caption`), so agents render
  tabular data as plain HTML tables with no per-visual CSS. The visuals
  skill forbids Markdown tables in replies for the same reason.
- **Presentation.** Height fits content via a host-owned size reporter inside
  the frame (clamped 120-1600px); visuals taller than 420px render collapsed
  with a fade and a Show all toggle so large blocks do not shove scrollback.
  No pane promotion, and no bridge of any kind (no sendPrompt, no
  postMessage API for model content) — interactivity is within-iframe over
  embedded data.
- **Taste layer.** One seeded `visuals` skill owns everything the agent
  renders — when to render, the visual and artifact fence contracts, and the
  full design system (`references/design-system.md`, `references/icons.md`,
  curated icon assets), all derived from DESIGN.md and the theme tokens. The
  managed prompt keeps a three-line pointer: the surfaces exist and the
  skill is a mandatory read before emitting any fence (ADR 0012). Skill
  sources are markdown files under
  `packages/agent-workspace/src/visuals-skill/`; quality is tuned with the
  design battery (`bun run eval:design`, `scripts/design-battery/RUBRIC.md`).

## Artifacts

The durable tier: an agent-authored self-contained single-file HTML page
that opens in the artifact pane. Authored as a bare ```` ```artifact ````
fence containing exactly one JSON object:

````markdown
```artifact
{"path":"workbench/report.html","title":"June report"}
```
````

Props are `{ path, title? }`; the path must be workspace-relative with
confined segments and an `.html`/`.htm` extension
(`packages/tavern-api/src/widgets/workspace-path.ts`). The transcript
renders a compact card (title, kind, open affordance) and never the page
itself; opening the card focuses the pane's workspace tab, where the pane's
sandboxed HTML preview renders the file with the app's theme tokens injected
as CSS variables. Rendering is live file state — later edits or deletion
change what historical chats display. See [artifacts.md](artifacts.md) for
the authoring contract.

## Contract

Both fences funnel into the widget render envelope. Names map one-to-one to
durable component ids `tavern.widget.<name>` where `name` is `visual` or
`artifact`. The stored envelope is:

```ts
{
  component: `tavern.widget.${name}`,
  fallback: { text: string },
  props: <validated per name>,
  target: "chat.inline"
}
```

A reply may contain multiple fences; each becomes its own activity in fence
order. An invalid fence (unknown name, malformed JSON, or props that fail
the schema) is stripped from the visible reply and produces no activity; the
prose still delivers. While an assistant is streaming, open `visual` fences
render progressively and `artifact` fences are hidden until the turn
completes.

## Storage

> **Dormant post-flip.** The flip removed per-turn response activities, so
> Runtime no longer writes `widget` activity and no `widget` chat rows are
> projected today. Visuals render entirely from message content (see
> **Persistence** above); the activity/row pipeline below describes the
> pre-flip contract that the artifact widget path still assumes, and is
> retained pending the artifacts decision. Do not wire new widgets to it.

Runtime stores each valid fence as response activity:

```ts
kind: "widget"
title: <display name>
metadata: {
  widget: { component, fallback, props, target },
  runtime: { agentId, messageId, runId, sessionKey, source, startedAt }
}
```

Server projects `widget` activity into chat rows with a `widget` payload.
The Website transcript renders that row inline inside the assistant turn.

## Legacy catalog replay

Historical chats contain stored activity for retired catalog widgets
(`tavern.widget.table`, `bar-chart`, `line-chart`, `composed-chart`,
`calendar-event`, `calendar-day`, `html-preview`,
`merchbase-sales-chart`). Their props schemas are gone, so both projection
paths degrade them identically: the stored envelope no longer validates, and
the row renders as a fallback card — the envelope's fallback text plus a
visible "Widget unavailable" state. No legacy renderers are kept. Legacy
`rich_response` activity from the older json-render system is dropped by a
one-time Runtime schema repair; old chats keep their prose.

## Ownership

Canonical names, props schemas, and the render envelope live in
`packages/tavern-api/src/widgets`. Visuals parse and render on the Website:
`splitVisualFences` (`packages/tavern-api/src/widgets/visual`) splits fences
from message content and `chat-transcript-turn.tsx` renders the iframe card —
Runtime no longer parses fences or writes `widget` activity. Server still
holds the dormant row projection (`apps/server/src/widgets/widgets.ts`) and
Website the `widget`-row renderers (`apps/website/src/widgets`: artifact card
and fallback card) for the pipeline noted under **Storage**. The pane's HTML
preview and host token injection live with the other pane renderers in
`apps/website/src/features/chats/` (see [artifacts.md](artifacts.md)).
