---
summary: Agent artifacts — durable self-contained HTML pages authored in the workspace, carded in chat, rendered in the artifact pane with host theme tokens.
read_when:
  - changing the artifact fence, its transcript card, the pane HTML preview, or host token injection
  - writing or reviewing agent guidance for authoring artifacts
  - deciding whether agent output belongs in chat (visual) or the pane (artifact)
---

# Agent Artifacts

Agents build durable artifacts as self-contained single-file HTML pages: the
chat transcript shows a compact card, and opening it renders the page in the
artifact pane's sandboxed HTML preview. The agent authors one `.html` in its
workspace (inline CSS/JS, no external or sibling assets) and references it
with a bare `artifact` fence. In-chat visuals cover in-conversation data;
artifacts are for anything the user will keep or
iterate on, and big surfaces stay out of the chat column.

## Authoring contract

- One self-contained `.html`/`.htm` file under `workbench/`: inline CSS/JS
  only, no external or sibling asset references, no multi-file projects.
- Reference it with a bare `artifact` fence: `{"path": "workbench/...",
  "title"?: string}`. The chat shows a compact card; the pane owns sizing.
- The taught token vocabulary — 40 role names in eight groups (type, surfaces,
  text, borders, emphasis, status, charts, layout: `--background`,
  `--foreground`, `--surface-secondary`, `--border`, `--muted-foreground`,
  `--accent-bg`, `--radius`, `--pad-md`, ...) — is injected into the page as
  CSS variables resolved for the current app scheme, so a token-styled page
  wears the Grotto look in light and dark. A separate legacy alias list ships
  beside it, emitted so pages authored against the old vocabulary keep
  rendering and taught to nobody. `styles/artifact-tokens.css` owns both —
  mostly aliases onto HeroUI roles, with named exceptions such as the text
  tiers, the layout group, and the chart palette — and pages write only the
  taught names, never a HeroUI name. Use the tokens
  with fallbacks and do not depend on any other host styling. The seeded
  `visuals` skill owns the authoring guidance — the full token vocabulary,
  page layout discipline, and self-containment rules — and the prompt only
  routes to it (ADR 0012).
- Rendering is live file state — later edits or deletion change what the card
  opens, the same replay caveat as `html-preview`.

## Security boundary

Identical to `html-preview`: the confined Runtime workspace read (realpath
confinement to the sending agent's workspace, secret-file blocks, complete
reads only within the 5 MiB HTML window) fetches the file, and the document
renders via `srcDoc` in a sandboxed iframe with scripts allowed and never
`allow-same-origin`. Token injection inserts one `<style data-grotto-tokens>`
block of resolved variable values; no app data, bridge, or postMessage API
crosses the boundary.

## Card and pane flow

The `artifact` fence funnels into the widget machinery (component id
`grotto.widget.artifact`; see [widgets.md](widgets.md)). The transcript
renderer (`apps/website/src/features/chats/artifact-card.tsx`) draws the compact
card — title, kind line, open affordance — and performs no workspace read.
Clicking calls the artifact-panel open path with a `workspaceFile` target,
the same merge-or-focus flow `grotto://workspace` links and the agent
`pane_open` tool use. In the pane, the workspace HTML preview
(`apps/website/src/features/chats/chat-artifact-workspace-preview.tsx`)
renders the page with host tokens injected
(`agent-html/tokens.ts`): the taught names and the legacy aliases are read off
the live document with `getComputedStyle` at render time and re-injected when
the app scheme flips, with `--accent-foreground`, `--success-foreground` and
`--warning-foreground` reading HeroUI's `-soft-foreground` values in the frame
and the radius names reading the artifact-owned `--radius-control` /
`--radius-card`. External-asset policy
is self-contained-only; if a CDN allowlist lands for in-chat visuals, artifact
rendering should mirror it.
