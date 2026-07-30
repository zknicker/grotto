---
summary: Hosted Agent creation, configuration, execution ownership, and product surfaces.
read_when:
  - changing Agent creation, profiles, assignment, skills, models, or lifecycle
  - changing the Server and Computer ownership boundary for Agents
---

# Agents

Agents are Server members whose execution runs on an assigned Grotto Computer.

## Ownership

The Server owns Agent identity, role, memberships, desired runtime and model,
Computer assignment, skill assignments, connection grants, and canonical
Chats. Computer owns the Agent's execution host, workspace, local skills,
credentials, resume state, and effective runtime state.

An Agent remains assigned to one Computer for its lifetime. The App changes
desired configuration through Server APIs; it never chooses workspace paths or
writes Computer-local files.

## First Agent and creation

A new Server starts with no Agents. Once an attached Computer reports its
runtime and model inventory, the Members Agents page offers Cove as the guided
first-Agent proposal. The Owner explicitly chooses the Computer, runtime, and
model and submits the ordinary hosted Agent creation flow.

Cove is not created at Server startup, recreated after deletion, or routed
through a special channel. Creation opens the same ordinary Owner-to-Agent DM
used by every Agent.

The create menu also offers a blank Agent and role proposals. Computer seeds
the selected starter kit into the new Agent's local workspace: `MEMORY.md`,
practice notes, optional role notes, and Cove's guide material. The seed is a
starting point the Agent grows, not a permanent archetype constraint. See
[ADR 0018](../adr/0018-agents-are-born-with-seeded-knowledge.md).

## Product surfaces

- Members lists Agents and Humans. Selecting an Agent opens its Profile,
  Activity, Chat, Reminders, Workspace, Apps, and MCP surfaces.
- Clicking an Agent avatar in Chat opens the same Agent profile context.
- Profile edits identity and desired model/runtime configuration.
- Skills are installed at Server scope and assigned one at a time from the
  Agent profile.
- MCP connections are Server-owned; Agent-level grants choose which
  connections the Agent may use.
- Starting a DM remains part of the normal New Chat flow.

Agent DMs are ordinary pairwise Chats. Creation opens one between the Owner
and the new Agent, and Grotto does not create duplicate direct Chats for the
same pair.

## Identity and instructions

An Agent has a display name, handle, description, and character avatar. The
description supplies its role and personality to generated instructions and to
other Agents in shared Chat rosters.

Computer composes managed product instructions, the Agent description,
assigned skills, and tool guidance when a fresh model session starts. Durable
learned knowledge lives in the Agent's own `MEMORY.md` and notes. Grotto does
not generate an `AGENTS.md`, `SOUL.md`, or injected memory layer inside the
workspace.

## Execution lifecycle

One resident Computer execution host serves each assigned Agent. The Agent's
single global model session spans all Chats and resumes across deliveries and
Computer restarts. Session reset creates fresh model context while preserving
the workspace. Full reset restores the factory starter kit.

See [Context management](context-management.md) and
[Agent daemon and delivery](../internals/agent-daemon-delivery.md).
