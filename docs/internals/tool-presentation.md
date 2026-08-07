---
summary: Tool call presentation pipeline — server label shaping, inline row renderers, and the tool-aware drawer registry, with extension points for custom tools.
read_when:
  - adding a custom row or drawer presentation for a specific tool name
  - changing tool row labels, verbs, running/completed states, or the inspect drawer
  - changing how tool arguments or results are summarized for the chat timeline
---

# Tool Presentation

How a tool call becomes a chat row and an inspect drawer, and where to plug in
custom presentation for a specific tool.

## Pipeline

1. **Runtime** stores each tool call as a response activity with full
   `metadata.tool.arguments` and `metadata.tool.result`. Nothing is truncated at
   this layer.
2. **Server projection** turns activities into timeline tool rows
   (`apps/server/src/chat/runtime-chat-api.ts`). Row labels come from
   `buildToolSummaryFromValues` (`apps/server/src/tools/summary.ts`). Shell
   tools accept `command` and `cmd` as the command argument.
3. **Row rendering** resolves a step component by tool name
   (`apps/website/src/features/chats/tool-steps/registry.tsx`).
4. **Drawer rendering** fetches the full call (`chat.tool.get` /
   `session.tool.get` — untruncated) and resolves a body component by tool
   name (`apps/website/src/features/sessions/tools/tool-drawer-registry.tsx`).

## Rules

- **Row labels describe intent, never outcome.** `summaryParts` derive only
  from tool arguments (command, path, pattern). Results belong in the drawer.
  Inline labels cap long targets; the inspect drawer keeps full values.
  Tests in `apps/server/src/tools/summary.test.ts` pin this.
- **Color is signal.** Completed verbs are neutral; red is reserved for
  failures; running rows shimmer (`thinking-indicator-text`).
- **The whole row opens the drawer.** The step row is the drawer trigger; the
  magnifier icon is a hover hint, not the click target.
- **Every contiguous tool group renders as a collapsed work drawer from its
  first step** (`apps/website/src/features/chats/chat-transcript-activity.tsx`
  → `WorkingLog` group mode). The header is permanent and uses the
  `chat-transcript-tool-intents.ts` entrypoint to summarize the top tool intent
  families: "Read 2 files, searched code" or "Updated tasks".
  Short commands and file paths can
  appear in the header; long commands, browser payloads, and
  search queries stay in the drawer. Active headers latch meaningful copy and
  animate short text changes with SlotText, so fast tool state changes do not
  flash between raw commands and "Working". If a failed tool is followed by
  later successful tool work, the header says the failure was recovered; the
  failed row keeps the specific tool and target, while the raw error stays in
  details. Expanding the drawer reveals the individual tool rows, which remain
  the inspect-drawer triggers.

## Adding custom presentation for a tool

Both registries resolve by normalized tool name: exact match, then substring
match, then a generic fallback. A business-specific tool usually needs one or
both of:

1. **Custom inline row** — add a renderer to `toolStepRenderers` in
   `apps/website/src/features/chats/tool-steps/registry.tsx`. It receives
   `ToolStepRendererProps` (`tool-steps/types.ts`) and should compose
   `ToolTimelineStep` + `InlineToolLabel` so it inherits the drawer trigger,
   enter animation, running shimmer, and status colors.
2. **Custom drawer body** — add a renderer to `toolDrawerBodyRenderers` in
   `apps/website/src/features/sessions/tools/tool-drawer-registry.tsx`. It
   receives `{ call: ToolDrawerCall }` (`tool-drawer-call.ts`) with the full
   arguments record and result. Compose the shared blocks in
   `tool-drawer-blocks.tsx` (mono blocks, copy buttons, section labels) so the
   drawer stays visually consistent. `resolveToolDrawerIcon` rides the same
   lookup for the header icon.

If the default row label is wrong for the tool, fix it at the source in
`buildSummaryParts` (`apps/server/src/tools/summary.ts`) rather than in a row
renderer. If the collapsed group header uses the wrong family, update
`chat-transcript-tool-intent-catalog.ts`; if it exposes the wrong target, update
`chat-transcript-tool-intent-resolver.ts`; if the words or priority are wrong,
update `chat-transcript-tool-intent-copy.ts`.

## Worked example: passive tool evidence

Tool activity is chat evidence, not a second control surface:

1. Runtime records the tool call with the source tool name, arguments summary,
   status, and durable activity id.
2. The activity projects as a tool row and optional live progress step with the
   same row id.
3. `buildToolSummaryFromValues` summarizes the row from source facts.
4. The row falls through to `GenericToolStep` unless a tool-specific renderer
   exists.
5. The transcript renders the row as evidence. Users control future tool access
   through settings, not through per-call prompts in the chat footer.

## Worked example: turn file-change evidence

The changed-files row (`tool-steps/workspace-changes-tool-step.tsx`,
registered as `workspace_changes`) is a Runtime-synthesized tool activity:

1. When a turn settles, Runtime compares its pre/post workspace snapshots and
   records a `workspace_changes` tool activity whose arguments carry the
   change summary (paths, line counts, `runId`) — never file contents.
2. The row renders "Changed N files"; the drawer body
   (`sessions/tools/workspace-changes-drawer-body.tsx`) lists the files and
   fetches before/after text on demand through `chat.turn.fileChanges`,
   rendering diffs with the shared `components/diff/diff-view.tsx`.
3. Selecting text in a diff quotes it into the composer with a `grotto://`
   source link (`components/quote/selection-quote.tsx`).

## Worked example: clarifications

The clarification row (`tool-steps/clarification-tool-step.tsx`, registered as
`clarify`) uses the same custom-renderer path:

1. Runtime records `clarify.request` as custom response activity with
   `metadata.clarification` and projects it as a `tool` step named `clarify`.
2. The renderer composes `ToolTimelineStep` with a question label and any
   historical settled state.
3. Grotto does not expose a per-question response route; users answer through
   normal chat messages when needed.
