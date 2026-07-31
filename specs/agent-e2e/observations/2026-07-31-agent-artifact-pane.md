---
read_when:
  - reviewing Agent-authored artifact fences, Thread cards, or the chat Artifact Pane
---

# Agent artifact pane — 2026-07-31

PRD-162 restores the hosted artifact-card flow for Agent replies inside task
Threads. A valid `artifact` fence now opens the authoring Agent's exact workspace
path in the chat-scoped Artifact Pane; malformed or unavailable targets retain
the existing concise UI.

Deterministic Browser E2E covers fence projection, the Thread card, pane
replacement without discarding a Thread draft, author ownership, and the
unavailable-file state. The focused Agent E2E covers a live Agent creating HTML,
emitting the fence, and opening the workspace file bytes in the sandboxed
themed preview.
