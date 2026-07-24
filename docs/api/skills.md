---
summary: Skills and Tools API for skill catalog reads, skill enablement, Runtime tool inventory, Plugin reflections, advanced MCP records, and setup blocker metadata.
read_when:
  - changing skill catalog, setup blocker, Runtime tool inventory, Plugin reflections, advanced MCP records, or agent access APIs
  - changing how clients list reusable runtime abilities and runtime tool access
---

# Skills and Tools API

The Skills and Tools API backs Settings -> Skills, Plugin capability
reflections, Runtime tool diagnostics, and advanced MCP capability records.

Skills are reusable instruction packages. Tools are executable agent actions.
Plugins are Tavern's normal user-facing integration surface. MCP servers are
advanced agent-engine connection records that may expose external tools behind a
Plugin or runtime experiment.

## Contract

* Skill ids are stable within the Runtime source.
* Installed skills are Runtime-owned packages. Inventory and detail reads come
  from the installed skill library.
* Installing a skill imports or copies it into the installed skill library; it
  does not assign it to an agent.
* Skill assignment is per-agent policy exposed through the Agents API as
  `enabledSkillIds`. Newly assigned skills must be globally enabled and free of
  setup blockers; saves that add unavailable skills are rejected.
* Setup requirements and source state are visible.
* A skill can be visible while Runtime reports setup blockers.
* Agent-authored skills are writable only by their creating agent. Other
  disk-backed and Plugin-owned skills remain non-editable on the agent surface.
* Hub installs record the installed content hash. Reinstalling an edited hub
  skill returns a conflict unless `force` is set. Available hub entries report
  `edited` and `updateAvailable` from the installed hash.
* Seeded `tavern-agent` and `visuals` skills can be reset to Tavern defaults
  through `POST /skills/:id/reset`; Runtime also refreshes changed seeded
  content when preparing managed skills.
* Tool ids are Runtime-native tool names.
* Tool enablement separates the user's choice from whether Runtime reports the
  tool as usable.
* Runtime may mark built-in tools as `readOnly`. Read-only tools are inventory
  facts, not user-toggleable settings or a standalone Tools page.
* MCP server records are separate from tool records and are not the default
  user-facing integration primitive.
* Runtime tool details are diagnostics, not copied Tavern skill instructions.
* Plugin-owned skills and tools are read-only reflections of Plugin and Service
  state.

## Surface

The API covers:

* list visible skills
* enable or disable Runtime skills
* list skills available to the current agent with source, writability, and
  enablement state through `skills_list`
* read a skill body and current hash through `skill_view`
* create an agent-authored skill through `skill_create`
* replace a disk-backed `SKILL.md` with hash checking through `skill_patch`
* write disk-backed support files under `references/`, `templates/`,
  `scripts/`, or `assets/` through `skill_write_file`
* reset a seeded Tavern skill to its current default
* read setup requirements
* list Runtime-visible tools
* read Runtime tool diagnostics where exposed
* read Runtime-provided usability and diagnostic text
* list available skills from chosen sources
* preview, scan, install, and uninstall available skills
* manage custom skill sources
* manage advanced MCP servers and the MCP catalog where exposed
* identify Plugin-owned skills and tools with Plugin metadata

## Runtime Boundary

Runtime owns skill discovery, tool discovery, tool eligibility, Plugin
reflections, MCP server records, dependency checks, prompt loading, sandboxing,
approval policy, and execution.

Runtime resolves an agent's `enabledSkillIds` during turn startup and passes
resolved skill bundles through `HarnessAgent`'s `skills` setting so the harness
adapter surfaces them as runtime skills. Runtime keeps broad Tavern behavior in
the instruction text and does not append `SKILL.md` bodies there.

Message skill references such as `[$ui](skill://ui)` are turn-scoped nudges.
They do not change `enabledSkillIds`, install a skill, or make a disabled skill
available. Runtime only adds an activation hint when the addressed Agent already
has that skill assigned; skill instructions still flow through the normal
`HarnessAgent.skills` bundle.

The first agent-engine pass exposes the built-in local tools as enabled,
configured, read-only Runtime tool diagnostics. Agent-specific access comes
from skill assignments, Plugin grants, sandbox mode, and approval policy rather
than mutable tool grants.

The app reads Runtime inventory and sends supported mutations back to Runtime.
It does not write discovered skill directories, authored tool files, MCP server
files, or Plugin-generated project files.

Runtime refreshes skill and tool inventory after startup and after capability
writes. App surfaces should refetch on Runtime capability events instead of
blocking navigation on live discovery.

Skill file writes publish `skill.updated` Runtime events. Hub uninstalls publish
`skill.deleted`. Server mutations refresh or enqueue skill inventory sync and
emit the same skill invalidation cascade used by other skill changes.

## Related Docs

* [Skills and Tools feature](../features/skills.md)
* [Agents API](agents.md)
* [API overview](overview.md)
