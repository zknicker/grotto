---
summary: Current agent product boundary for Runtime-managed agents, settings ownership, and synced sessions.
read_when:
  - changing how users work with the managed agent
  - changing model, tool, memory, or skill access for the managed agent
---

# Agents

Tavern Runtime supports multiple managed agents. Tavern App exposes agent
creation and per-agent controls from the Settings sidebar while the main chat UI
can continue to feel primary-agent-first.

## Current Contract

* **Bootstrapped agent.** Tavern bootstraps `agt_primary` so a fresh Runtime is
  immediately useful.
* **Agent DMs.** Each Runtime-managed agent has one built-in DM with the local
  human operator. Tavern does not create duplicate direct chats for the same
  agent.
* **Runtime-managed agent records.** Runtime can store multiple agents with
  independent names, enabled skill ids, model choices, and workspace folders.
  Settings -> Agents lists those agents, creates new agents, and routes each
  agent to General, Skills & Plugins, and Channels pages.
  General edits the selected agent's display name, bio, color, character,
  model, thinking default, environment variables, and destructive agent
  deletion. The home timezone lives on the Tavern Runtime settings page.
* **Creation proposals and the starter kit.** The Members-page create menu
  offers a blank agent plus archetype proposals (operator, analyst, designer,
  writer, coordinator, patrol, verify gate, onboarding guide). Every new
  agent's workspace is seeded with a starter `MEMORY.md` and practice notes;
  an archetype adds its lane note, and the onboarding guide adds its
  playbook, objectives, and FAQ. The archetype is not stored — the seed is a
  starting point the agent grows (see
  [ADR 0018](../adr/0018-agents-are-born-with-seeded-knowledge.md)). A full
  reset returns the workspace to this factory starter kit.
* **Agent bio.** A short job description stored on the Runtime agent record.
  Agents sharing a chat see each other's names and bios in their prompt
  roster, so each agent knows what its co-resident agents are for. The chat
  transcript shows the bio beside the agent's name on each message group.
* **Agent avatar.** Every agent wears a character face (knight, penguin, cat,
  dog, robot, ghost, or cloud) as its avatar; the animated eyes always sit
  inside a character and are never shown alone. Agents with no chosen character
  get a stable default derived from their id. Agent color labels the agent's
  name; it does not tint the avatar. To add or change a character, see
  [Agent avatars](../internals/agent-avatars.md).
* **Instruction files.** Runtime composes the agent's system prompt from
  Tavern-managed instruction text and the agent's description — the
  personality surface (see [Context management](context-management.md)).
  There is no separate identity file to edit; durable per-agent notes are the
  agent's own workspace files (`MEMORY.md` and notes/), which it maintains
  itself. Tavern does not write a generated `AGENTS.md` file into the agent
  workspace.
* **New chats.** Starting a direct chat belongs to the normal New Chat flow, not
  an agent landing page.
* **Agent skills and Plugins.** Runtime stores per-agent enabled skill ids.
  Assigned skills are resolved from Runtime's installed skill library and added
  to the agent's AI SDK instructions at turn startup. Plugin grants decide which
  built-in Plugin tools and Plugin-owned guidance the agent receives. Harness
  tools come from the selected executor and are governed by sandbox and approval
  policy.
* **Web access.** A per-agent opt-in (default off) on the General settings
  page. When on, the agent can search the web (provider-native search, when the
  agent's model supports it) and fetch pages with the Runtime `web_fetch` tool,
  which returns readable, size-capped markdown. Web content is treated as
  untrusted reference data: the agent is instructed to cite sources and never
  follow instructions found in fetched pages. When off, the web tools are
  absent from the agent's turns.
* **Sessions.** Synced Tavern, system, and external chats are visible from
  Settings -> Sessions with source filters.

## App surfaces

The primary app sidebar lists product areas and chats. It does not list agents.
Agent configuration lives in Settings -> Agents. Each agent has its own sidebar
section with General, Skills & Plugins, and Channels pages. The
Skills & Plugins page lists only what the agent already has; new skills and
Plugin grants are added through searchable pickers that offer only globally
usable entries, so global setup problems never render as per-agent noise.
Model fallbacks, web page summarizer model, context compression, permission
prompts, and subagent model defaults are not settings surfaces until the local
agent engine supports them.

## Runtime boundary

Tavern Runtime owns local agent execution, managed agent records, available
capabilities, and canonical chat state. Tavern App creates and edits agents
through first-class Tavern APIs; it does not write agent engine files or choose
runtime workspace paths.
