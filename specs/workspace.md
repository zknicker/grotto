# Agent Workspace

Grotto Computer owns one isolated local root for each assigned Agent:

```text
agents/<agent-id>/
  workspace/
  home/
  skills/
  runtime/
```

The Server owns the Agent's identity, desired configuration, membership, and
immutable Computer assignment. It never owns or synchronizes the Agent's local
workspace. The workspace is the Agent's durable working environment and the
default working directory for its execution harness. It is organization, not a
security boundary.

## Durable knowledge

The Agent controls the structure of its workspace. The starter kit provides:

- `MEMORY.md`, a concise recovery index;
- `notes/`, for durable detail and operating knowledge;
- optional archetype notes and, for Cove, guide objectives and playbooks.

The seed establishes a useful starting point and never overwrites an existing
workspace. The Agent may add, rename, organize, and remove task-specific files
as its work requires.

There is no managed `NOTES.md`, `SOUL.md`, injected core-memory section,
automatic extraction or dreaming pipeline, or separate Wiki primitive.
Personality comes from the Server-owned Agent description. Durable learned
role and context live in the Agent-owned workspace.

## Skills and credentials

Installed skills live in the Agent's sibling `skills/` directory and are
exposed according to Server-owned assignments. Harness credentials and CLI
state live under the Agent-specific `home/`; Computer must not copy broad host
configuration into the Agent root or commit local state.

## Lifecycle

The local root survives ordinary idle periods, Computer restarts, model or
runtime changes, and session reset. Session reset creates fresh model context
without erasing the workspace. Full reset restores the factory starter kit.
Retirement removes the local execution host after Server retirement has
completed.

Canonical chat history remains on the Server. Agents recover older
conversation context through the Grotto CLI rather than treating the workspace
as a transcript mirror.
