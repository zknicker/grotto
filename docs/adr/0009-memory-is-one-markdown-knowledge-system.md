---
summary: Superseded decision that previously split per-Agent Memory from a shared Wiki.
read_when:
  - understanding the history of Agent memory, extraction, dreaming, or Wiki
  - changing the current Agent workspace knowledge contract
---

# ADR 0009: Memory And Wiki Are Separate Markdown Knowledge Surfaces

**Status:** Superseded by
[Raft alignment D3](../../specs/raft-alignment/README.md), then by
[ADR 0021](0021-cove-onboards-and-agents-share-a-manual.md) for the current
workspace and Manual contract.

## Historical decision

This ADR originally defined injected core-memory files, automatic extraction
and dreaming workers, and a separate shared Wiki. That product model is no
longer current.

## Current contract

Each Agent owns its durable local knowledge:

- `MEMORY.md` is a concise recovery index.
- `notes/` contains durable detail the Agent chooses to keep.
- The Agent reads and writes these files directly while working.

Grotto does not inject core-memory sections or run extraction, dreaming,
recall, Wiki, or Memory-worker jobs. Shared conversation history remains
canonical Server data. Reminders wake the Agent when scheduled, and the Agent
recovers relevant context from its workspace and Server history.

Session reset preserves the workspace. Full reset restores the Agent-kind
factory workspace described by
[ADR 0021](0021-cove-onboards-and-agents-share-a-manual.md): minimal
`MEMORY.md` for an ordinary Agent or Cove's four-file onboarding seed.
See [ADR 0011](0011-agents-own-one-global-session.md) for session continuity.
