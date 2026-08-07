# Tools

Tools are Grotto's inline execution interactions.

## Product Expectations

- A tool interaction is response activity that represents a tool invocation and its result as one
  understandable product interaction.
- A tool interaction is not just a raw message fragment.
- A tool interaction is not a worker.

## Relationships

- A tool interaction appears in chat history as response activity.
- Runtime session history may keep the raw transcript evidence behind that activity.
- A tool interaction is invoked by an agent.
- A tool interaction may link to spawned sessions, workers, or artifacts.

## Presentation

- Tool interactions render as first-class rows, not duplicated invocation/result noise.
- The product makes tool name, status, and summary understandable without exposing raw tool
  protocol details.
- Tool outputs that are independently renderable, such as files, images, diffs, or code snippets,
  are artifacts linked from the activity row.
