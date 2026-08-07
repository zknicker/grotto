# Local Agents

Local agents are durable workers and personalities owned by Grotto Runtime.

## Product Expectations

- A local agent has a stable Runtime identity.
- A local agent has a user-facing name.
- A local agent has durable instructions that define how it behaves.
- A local agent may expose editable files. File names and meanings come from Runtime.
- A local agent has durable working context according to Runtime's model.
- A runtime agent can participate in conversations, scheduled jobs, and delegated work when the
  Runtime supports those capabilities.
- A local agent feels like the same entity wherever Grotto presents it.

## Agent State

- Runtime stores the execution config used by the agent.
- Runtime composes the execution-time prompt from instruction, skill, memory,
  identity, project, and live execution layers.
- Grotto App may read and update supported agent config through Runtime APIs.
- Grotto App may browse and edit supported agent files through Runtime APIs.
- Grotto may store presentation overlays for the agent.
- Grotto does not define agent identity from channel identity or chat identity.

## Participation

- A local agent may participate in zero or more chats.
- A chat may include one or more local agents when Runtime supports multi-agent chat
  participation.
- Grotto product flows currently resolve one primary agent, while runtime calls should still target
  an explicit Runtime agent id.

## Delegation

- Local agents may delegate work if Runtime supports delegation.
- Delegated work should remain attributable to a real Runtime agent or session.
- Temporary helper sessions and execution teams are Runtime techniques, not replacements for the
  durable Grotto agent record.

## Constraints

- Agent identity does not come from the channel.
- Agent identity does not come from the chat.
- Project context files such as `AGENTS.md` do not define the runtime agent's stable personality.
- A runtime agent does not require a separate runtime process unless the runtime chooses that model.
