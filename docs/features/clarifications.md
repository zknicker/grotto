---
summary: Historical clarification activity rows for agent questions.
read_when:
  - changing agent question activity or clarification rows
  - changing chat activity rows for agent questions
---

# Clarifications

Clarification rows are historical agent-question activity. Grotto no longer
pauses a turn for an in-chat answer form; agent execution should continue using
normal model/tool behavior.

When a Runtime activity includes clarification metadata, Grotto renders the row
as a question instead of a generic tool invocation. Existing settled rows can
still show answered, skipped, or timed-out state from historical data.

See [Clarifications](../../specs/clarifications.md) for the runtime and
presentation contract.
