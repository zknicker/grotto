# Agents

Tavern presents one primary Runtime-backed agent that it observes, presents, and configures
through Runtime APIs. Normal product surfaces resolve the primary agent instead of asking the
person to choose among internal runtime workers.

## Product Expectations

- An agent has a stable Runtime identity.
- An agent has a user-facing name.
- An agent feels like the same worker wherever Tavern presents it.
- An agent remains visible in Tavern when Runtime is offline if Tavern has already synced
  it.
- An agent is not a session, turn, worker process, or tool call.
- Product-facing navigation, chat start, cron setup, skills, model settings, and messaging
  bindings presume one primary agent.
- Plural agent lists are runtime/internal surfaces, not normal product navigation.

## Ownership

- Runtime is canonical for execution config.
- Runtime agent config may include name, model route, skill assignments, exact MCP and host-tool
  grants, workspace, and generated instruction context.
- Tavern exposes Runtime's per-agent thinking setting as model effort when the Runtime supports it.
- Tavern reads and writes supported agent config through Runtime APIs.
- Tavern does not keep a competing canonical agent config store.
- Tavern may keep local presentation overlays such as color and local notes.
- Tavern exposes agent display name and color as editable agent settings on the agent record.
- The home timezone is a runtime-wide Runtime-stored setting (system default when unset); it
  governs schedules, Memory day bucketing, and time-aware answers.
- Runtime-native edits made outside Tavern refresh Tavern through sync and events.

## Relationships

- An agent belongs to the stable Runtime namespace.
- An agent may participate in many chats.
- An agent may run many sessions.
- An agent may own many turns and workers.
- An agent may author many messages and tool interactions.
- Tavern selects one primary agent for user-facing flows. Multi-agent support uses
  explicit product behavior rather than leaking runtime lists into the UI.

## Lifecycle

- Creating, editing, or deleting an agent in Tavern acts on Runtime when the Runtime
  supports that operation.
- If Runtime reports an agent removed from an authoritative agent snapshot, Tavern removes the
  current agent row.
- Tavern-owned overlays may remain available for reuse only when they are not represented as a live
  Runtime agent.
