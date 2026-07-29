---
summary: Agent-local skills and explicit imports from a Computer.
read_when:
  - changing Agent skill discovery, import, authoring, or execution
  - changing the Skills settings surface
---

# Skills

A skill is an instruction bundle in one Agent's library on its assigned Computer.
Each Agent has one canonical, writable library. The harness and native skill
paths read that exact directory, so an Agent never executes the operator's
global skills or another Agent's library by accident.

## Importing

An attached Computer reports compact metadata for skill bundles installed in
the operator's standard skill directories. The Server stores the latest report
so Settings -> Skills remains useful while the Computer is offline. Skill
contents never pass through or persist on the Server.

Settings -> Skills is the Server's browse-only view of these reported sources.
An Owner or Admin adds one from the searchable Skills picker on an Agent's
Profile while that Computer is online. The Computer copies the complete bundle
into the Agent's library. The source is unchanged, the Agent copy is
independent, and no later sync occurs. A same-name copy must be removed or
renamed explicitly before it can be imported again.

Computer inventory changes arrive through the Server update subscription. The
App does not poll for skill or import changes.

Imports wait for an active turn to finish. The next turn receives the updated
library; a running turn is never mutated.

## Agent authoring

Agents manage their own library through `grotto skill`:

- `list` and `view`
- `create` and `patch`
- `write-file`
- `delete`

These commands resolve only inside the calling Agent's library. Symlink escapes
and cross-Agent paths are rejected. Deleting an imported skill deletes only the
Agent's independent copy, never its host source.

## Tools are separate

Skills teach; tools act. Executable capabilities come from the selected harness
and exact MCP grants. MCP credentials stay on the Computer, and discovering a
new MCP tool never grants it automatically.

## Missing on purpose

- Ambient execution of globally installed host skills.
- Automatic skill sync or a compatibility layer between libraries.
- A shared Server-side skill-content store.
- A generic toolset or skill marketplace.
