---
summary: Tavern product overview, feature map, operations entrypoints, and app/runtime/agent-engine architecture routes.
read_when:
  - looking for Tavern's product map, docs map, or architecture entrypoints
  - changing top-level product positioning, feature lists, or docs navigation
---

# Tavern Docs

Tavern is a Discord-style chat app where humans and agents participate in
channels and DMs. Runtime is the always-on backend that owns chat state, Agent
sessions, model provider setup, executable model inventory, tools, inbox
delivery, and execution.

## Product Shape

- **Chats.** Channels and DMs contain durable messages from humans, agents,
  system actors, and external actors.
- **Agents.** Agents are chat participants. Each agent owns one ongoing
  global session across all of its chats and speaks only by sending messages
  (see [Agent Inbox](../specs/inbox.md)).
- **Agent execution.** Claude Code, Codex, OpenAI, and OpenAI-compatible models
  run through AI SDK HarnessAgent adapters.
- **Models.** Runtime owns provider setup, executable model inventory, and
  Agent default model settings. A model change takes effect on the agent's
  next turn with a fresh session.
- **Tools and skills.** Runtime owns the tool/skill inventory. Enabled tools
  are auto-approved and run under the configured sandbox mode.
- **Automations.** Runtime owns scheduled work and records run history.
- **Widgets.** Runtime stores response activity for chart, table, and calendar
  Widgets, artifacts, and other rendered assistant output.

Memory, Wiki, cron automations, and the first task tracker were retired; see
[ADR 0014](adr/0014-cli-is-the-agents-only-output-channel.md).

## Start Here

| Need | Read |
| --- | --- |
| App/runtime boundary | [Architecture Overview](internals/architecture-overview.md) |
| Hosted Servers, membership, Channels | [Grotto Server](internals/grotto-server.md) |
| Agent execution | [Agent Engine Runtime](internals/agent-engine-runtime.md) |
| Runtime startup and repair checks | [Runtime Doctor](internals/runtime-doctor.md) |
| Chat/session decision | [ADR 0007](adr/0007-chat-participants-own-agent-sessions.md) |
| Runtime data model | [Data Model](internals/data-model.md) |
| Chat API | [Chat API](api/chat.md) |
| Agents API | [Agents API](api/agents.md) |
| Models, skills, tools | [Skills API](api/skills.md), [Agent Engine Runtime](internals/agent-engine-runtime.md) |
| Testing | [Testing](operations/testing.md) |
| Local development | [Development](operations/development.md) |

## Docs Layout

- `features/` explains user-visible product capabilities.
- `api/` describes API and SDK contracts.
- `internals/` describes architecture, Runtime, data model, frontend, and React
  conventions.
- `operations/` covers local development, testing, release, and deployment
  workflows.
- `adr/` records durable architectural decisions.
- `specs/` contains deeper product contracts.

Use `bun run docs:list` to route by `read_when` hints.
