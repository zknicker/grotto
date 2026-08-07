---
summary: Superseded decision to use json-render Rich Response specs for visual assistant replies.
read_when:
  - reading the history behind Widget fences (see 0010-widgets-use-tagged-fences.md)
---

# Rich Responses use json-render specs

**Superseded by [ADR 0010](0010-widgets-use-tagged-fences.md): Widgets use tagged fences.**

Grotto uses one json-render Rich Response island per assistant response. Rich Responses use a first-class `rich_response` activity kind, a Grotto-owned catalog of allowed components, and compact generated agent instructions that allow a `spec` fence when an answer is naturally table-, chart-, calendar-, or UI-shaped. The old render-tool path is removed instead of retained as a compatibility layer.

**Consequences**

The initial Rich Response Catalog contains Grotto-styled `Stack`, `Heading`, `Text`, `Separator`, and `Table` components plus the existing three chart displays and two calendar displays. `Stack` is vertical-only in v1 so Rich Responses stay chat-shaped and readable. Stored chat history, Runtime projection, Server rows, Website rendering, demos, tests, and generated instructions use Rich Response language instead of preserving old widget behavior. SpecStream compilation comes from json-render core; Website rendering uses `@json-render/react`; Grotto keeps product-specific persistence, styling, and per-component validation.

Grotto uses json-render's default catalog prompt assembler instead of a custom prompt template. The persisted chat contract accepts json-render state, repeat, event, watcher, visibility, and dynamic-prop fields that `@json-render/react` can render. Grotto's constraints live in the component catalog and product-specific rules: only Grotto chat components are available, `Stack` owns child composition, and model-authored HTML, JSX, CSS, imports, class names, and tool names are not accepted.

The json-render chat example is Grotto's reference implementation for mechanics: the agent emits a fenced JSONL spec, Runtime compiles complete patches while the assistant streams, the app renders one progressive island, and layout/text components compose multiple displays inside that island. Grotto borrows that flow while using Grotto-owned catalog schemas, app-styled Surface components, and chat-first product rules instead of the example's broad shadcn catalog.
