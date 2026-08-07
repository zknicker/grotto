# Clarifications

Clarification rows are historical agent-question activity.

## Product Contract

- A clarification is not presented as a raw tool call. It is a response
  activity in the active chat turn.
- The activity renders in the work log as a question row, not as a generic tool
  invocation.
- Grotto does not pause an active turn for an answer form. Users can reply with
  a normal chat message when the answer belongs in the conversation.
- Historical completed clarification rows may remain visible as answered,
  skipped, or timed out when imported or replayed from older activity.

## Runtime Contract

- Grotto Runtime records the prompt as response activity with
  `metadata.clarification` and `metadata.runtime.toolName = "clarify"`.
- The durable activity uses the existing custom activity kind and projects to a
  live `turn.progress` tool step named `clarify` with a typed `clarification`
  payload.
- There is no Grotto API route for responding to clarification rows.

## Presentation

- Clarification rows use the same tool-row drawer, grouping, and live/durable
  reconciliation behavior as other work activity.
- The collapsed active work label reads `Needs an answer`, not `Using clarify`
  or `Using <question>`.
- Pending rows show the question. They do not render choices, Other, Skip, or
  inline answer controls.
