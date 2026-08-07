# Workers

Workers are Grotto's view of autonomous background agent work.

## Product Expectations

- A worker is an inspectable unit of background work.
- Workers should feel like first-class Grotto objects rather than leaked runtime task records.
- A worker should make it easy to understand what work was running, who ran it, and what it was
  related to.
- A worker is not a task card, session, or tool interaction.
- A worker is distinct from a planning task. Those should remain separate Grotto primitives even if
  they may later be linked.

## Runtime Observation

- Workers are observed runtime state.
- Worker data may keep syncing in the background from a connected runtime.
- Previously observed workers should remain visible when the runtime is offline.

## Relationships

- A worker may relate to an agent, a session, a cron run, or other runtime activity.
- The product should make those relationships easy to inspect without forcing the person to decode
  raw runtime metadata.
