---
summary: Decision to render assistant UI as per-widget tagged fences with flat JSON props, replacing json-render Rich Responses.
read_when:
  - changing Widget persistence, fence parsing, props schemas, prompts, or rendered assistant UI
  - changing response activity kinds for app-rendered assistant UI
  - considering a generative UI library or free-form model-authored layout
---

# Widgets use tagged fences

> Amended 2026-07-20: the closed widget catalog this ADR introduced is
> retired. The tagged-fence mechanism and the `grotto.widget.<name>` activity
> envelope survive, but the only fences agents author are `visual` and
> `artifact`; stored catalog widgets replay as fallback cards. See
> [widgets.md](../internals/widgets.md) and ADR 0012.

Grotto renders assistant UI as Widgets: the assistant writes one fenced code
block per widget whose language is `widget:<name>`, containing exactly one flat
JSON object validated by that widget's Zod props schema. Widgets store as
first-class `widget` response activity and render through a hand-wired
name-to-component switch in the Website. This supersedes ADR 0003; the
json-render Rich Response spec island, its catalog prompt assembler, and the
`@json-render/core` / `@json-render/react` dependencies are removed instead of
retained as a compatibility layer.

**Context**

Grotto's product direction is curated, purpose-built widgets — the model
supplies data, the app owns presentation and interactivity — not free-form
generative UI composed from layout primitives. The json-render integration
optimized for the latter: its always-on catalog prompt cost ~3.9k tokens per
turn (mostly teaching JSON Patch mechanics and dynamic-value syntax the
catalog barely used), replies carried JSON Patch boilerplate, and the only
meaningfully interactive component (`MerchBaseSalesChart`) implemented its
interactivity in React rather than in spec state.

**Consequences**

The widget catalog keeps the data-shaped components: `table`, `bar-chart`,
`line-chart`, `composed-chart`, `calendar-event`, `calendar-day`, and
`merchbase-sales-chart`. The layout and text primitives (`Stack`, `Heading`,
`Text`, `Separator`) are removed — prose around the fence carries narrative,
and a reply may contain multiple widget fences, each becoming its own activity.
Model-authored HTML, JSX, CSS, class names, state, repeat, event handlers, and
dynamic prop expressions are not accepted.

The Widgets prompt is hand-written but assembled per agent from per-widget
entries (`packages/grotto-api/src/widgets/prompt.ts`, ~800 tokens for all
widgets, a ~79% cut). A `satisfies Record<WidgetName, WidgetPromptEntry>` guard
makes an unregistered widget a compile error. Plugin manifests declare their
Widgets under `widgets` by name, and Runtime scopes the prompt to each agent's
grants: core widgets always, plugin widgets only when the Plugin is enabled and
granted. A non-MerchBase agent drops the ~186-token MerchBase entry.

Legacy `rich_response` activity rows are dropped by a one-time Runtime schema
repair (mirroring the earlier widget-to-rich-response migration); old chats
keep their prose but lose the rendered islands. Stored chat history, Runtime
projection, Server rows, Website rendering, demos, tests, and generated
instructions use Widget language throughout.
