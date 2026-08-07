# Grotto Skill

The `tavern` skill is the agent's interface to Grotto itself: product
knowledge for advising the user, and operational access for acting on Grotto
state.

## Product Expectations

- The agent can answer questions about Grotto accurately: what Grotto is,
  where settings live, how chats, sessions, automations, skills, and memory
  work as products.
- The agent can operate Grotto on the user's behalf within explicit bounds:
  find and read chats, send messages, and manage automations with Grotto
  delivery semantics.
- The skill speaks product language. It does not describe agent-engine plumbing.
- The skill degrades gracefully: when Runtime is unreachable or a capability
  is down, the agent reports the limitation instead of inventing state.

## Ownership

- Grotto Runtime owns the skill content and installs it into the managed
  skills surface, the same lifecycle pattern as the `memory` skill. Users do not
  hand-install or edit it; Runtime refreshes it on sync.
- The skill authenticates to Grotto Runtime with the runtime URL and token
  already provisioned to the managed engine environment.
- Grotto Runtime owns the API surface the skill calls. Skill recipes are thin
  documented calls; product behavior lives in Runtime.

## Capabilities

The skill documents and exposes:

- **Chats.** List and search the agent's Grotto chats; read chat history.
- **Messages.** Send a message to a Grotto chat, attributed to the agent.
- **Automations.** Create, inspect, update, and delete automations using
  Grotto nouns and the Grotto delivery contract ([cron.md](cron.md)).
- **Skills.** List the agent's enabled skills and tools.
- **Self-configuration (read-only).** Read the agent's own model, effort, and
  enabled capabilities so it can describe its configuration to the user.
- **Settings map.** Where the user changes each setting in the app, so the
  agent can direct rather than guess.

## Boundaries

- No raw engine config mutation. Configuration changes route the user to the
  appropriate settings surface.
- No app-local state: cache, presentation, or app-shell preferences.
- No secret reads or writes.
- Message sends and automation writes are attributed to the agent and visible
  in normal chat and automation history; the skill adds no hidden side
  channels.
