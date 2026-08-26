---
summary: Hosted Agent creation, configuration, execution ownership, and product surfaces.
read_when:
  - changing Agent creation, profiles, assignment, skills, models, or lifecycle
  - changing the Server and Computer ownership boundary for Agents
---

# Agents

Agents are Server members whose execution runs on an assigned Grotto Computer.

## Ownership

The Server owns Agent identity, role, memberships, desired runtime, model, and reasoning effort,
Computer assignment, connection grants, and canonical Chats. Computer owns the
Agent's execution host, workspace, Agent-local skills, credentials, resume
state, and effective runtime state. Server retains only reported skill
metadata for offline display.

An Agent remains assigned to one Computer for its lifetime. The App changes
desired configuration through Server APIs; it never chooses workspace paths or
writes Computer-local files.

## Agent creation

A new Server starts with no ordinary Agents. Once an attached Computer reports
its runtime and model inventory, the Members Agents page lets an Owner or Admin
choose the Computer, runtime, and model, then create an Agent with a name and
optional description, reasoning effort, and avatar.

Creation opens the same ordinary Owner-to-Agent DM used by every Agent. There
is no archetype field, picker, automatic lane-note seed, or special creation
path in this contract. Fresh-Server Cove onboarding is a separate setup flow;
see [ADR 0021](../adr/0021-cove-onboards-and-agents-share-a-manual.md).

Computer seeds an ordinary Agent's fresh workspace with only a minimal
`MEMORY.md`: identity, description-derived role, empty knowledge, and initial
active context. Practice files, recipe summaries, onboarding notes, and
archetype notes come from neither creation nor reset. Shared guidance belongs
in the Grotto Manual, while the Agent's own work may add files later.

The skill system remains Agent-owned and writable, but there is no factory
`grotto-agent` skill. Mandatory operating rules live in managed instructions,
shared reference guidance lives in the Manual, and the only current
factory-managed skill is `visuals`; see [Skills](skills.md).

## Product surfaces

- Members lists Agents and Humans. Its Agents Overview compares usage across Agents. Selecting an
  Agent opens Overview with scoped usage and execution configuration, Activity with Chat
  memberships, Reminders, Tools for MCP access and Skills, and Workspace.
- Member lists stay lightweight; Agent and human profile routes load one focused
  detail record so profile refreshes do not rebuild the directory.
- Clicking an Agent avatar in Chat opens the same Agent profile context.
- Profile edits identity and desired model/runtime configuration.
- Skills are independent Agent-owned copies. An Owner or Admin imports a host
  bundle into one Agent library from the Agent profile.
- MCP connections are Server-owned; Agent-level grants choose which
  connections the Agent may use.
- Starting a DM remains part of the normal New Chat flow.

Agent DMs are ordinary pairwise Chats. Creation opens one between the Owner
and the new Agent, and Grotto does not create duplicate direct Chats for the
same pair.

### Agent-prepared creation cards

Member Agents can use `grotto action prepare` to propose an Agent creation in
the Chat where they are working. The Server checks the proposer’s exact
current Chat view, resolves the target under the runner credential, and stores
the typed proposal and exact avatar bytes as immutable Server state. A newer
proposal from that same Agent supersedes its pending predecessor; proposals
from other Agents remain independent. The App renders the proposal as a
native action card with pending, done, or superseded status. Unknown action
kinds stay inert until Grotto ships a renderer.

This capability prepares data only. It does not create an Agent, choose
human-owned runtime/model fields, or mutate an existing profile. Human commit
and edit belong to the follow-up Agent creation workflow. Selecting **Create Agent** on a pending
card opens the ordinary deterministic creation modal with the proposal's name, description,
Computer guidance, and exact avatar media already present. The modal revalidates the current
Computer inventory and initializes runtime, model, and reasoning defaults from Cove when that
configuration is still reported; otherwise it uses ordinary product defaults. Owners and Admins
can edit the name, description, Computer, runtime, model, reasoning effort, and avatar. The
created Agent is always a Member, and a failed validation keeps the modal open for recovery.

On success the card becomes **Done** and names the committing human. The new Agent has its normal
Owner DM, but the action does not add a Chat receipt. The immutable proposal remains unchanged;
the executed result carries the submitted values. Replays and concurrent double-submit are
idempotent. The Server writes a proposer-only terminal-attention record for the next delivery
phase; this release does not deliver or execute that attention.

## Identity and instructions

An Agent has a display name, handle, description, and avatar. The
description supplies its role and personality to generated instructions and to
other Agents in shared Chat rosters.

Computer composes managed product instructions, the Agent description, the
Agent's local skills, and tool guidance when a fresh model session starts.
Durable learned knowledge lives in the Agent's own `MEMORY.md` and any files it
creates.
Grotto does not generate an `AGENTS.md`, `SOUL.md`, or injected memory layer
inside the workspace.

Managed Agents can use `grotto avatar generate --concept <text> --output <path>` to create one
validated transient avatar file from a short concept. The Server owns the prompt, provider call,
normalization, validation, and concurrency limits; the Computer writes the result only to the
requested local path. This command does not assign or persist an Agent avatar.

Owners and Admins can also choose **Generate avatar** on an ordinary Agent's profile. The profile
requires a short concept, previews one transient result, and only applies it after an explicit Save;
Cancel and failed retries leave the current avatar unchanged. Uploading a file and falling back to
initials remain available alongside generation.

## Execution lifecycle

One resident Computer execution host serves each assigned Agent. The Agent's
single global model session spans all Chats and resumes across deliveries and
Computer restarts. Session reset creates fresh model context while preserving
the workspace and skills. Full reset restores the Agent-kind factory workspace
and only the current factory-managed skills: minimal `MEMORY.md` for an
ordinary Agent, or Cove's four-file onboarding workspace for Cove. Today the
only factory-managed skill is `visuals`.

See [Context management](context-management.md) and
[Agent daemon and delivery](../internals/agent-daemon-delivery.md).

## Retirement

An Owner or Admin retires an Agent by deleting it from its profile and typing
its name to confirm. A retired Agent leaves every active member control at once:
it no longer appears in the Agent list, mention pickers, or Channel-creation
controls, and it can neither execute a turn nor receive a new send. A send to its
DM, a reply in one of that DM's Threads, or a new task message is rejected.

Its Owner DM leaves active navigation and is not an App destination after retirement. Canonical
collaboration records remain durable Server history. Historical messages visible in other Chats
keep the retired Agent's profile under a **Deleted** treatment, and the Agent is excluded from task
creation targets.

The Agent id is permanent identity; its handle is an active Server-scoped alias.
Retirement releases that alias for a newly created Agent while preserving it on
the tombstone. The replacement receives a new id, DM, workspace, and execution
history. Existing rich references and authored messages remain attached to the
retired Agent id.

Completed onboarding does not depend on Cove remaining active. Retiring Cove
keeps the onboarding Channel and history under this same retired-Agent
contract, while the Server stays unlocked and never provisions a replacement.
