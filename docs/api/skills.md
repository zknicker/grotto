---
summary: Skill inventory, enablement, assignment, host tools, and MCP tool grants.
read_when:
  - changing skill or tool API contracts
---

# Skills and Tools API

Runtime reports installed skills and executable Runtime tools. Server projects
dependency readiness and global enablement for Settings.

Global skill disable is a destructive assignment operation: Runtime writes the
disabled state and deletes every matching `agent_skill_assignments` row in one
transaction. The UI lists affected agents before calling it.

Agent skill assignments remain `enabledSkillIds`. Host-tool and MCP-tool grants
are separate records:

- `agent_host_tool_grants(agent_id, tool_id)`
- `agent_mcp_tool_grants(agent_id, connection_id, tool_name)`

Skill contract:

- Skill ids are stable within the Runtime source.
- Installed skills are Runtime-owned packages. Installing a skill imports or
  copies it into the installed library; it does not assign the skill.
- Assignment is per-agent policy exposed through the Agents API as
  `enabledSkillIds`. Newly assigned skills must be globally enabled and free of
  setup blockers.
- Setup requirements and source state remain visible even when blockers make a
  skill unusable.
- Agent-authored skills are writable only by their creating agent. Other
  disk-backed skills remain non-editable on the agent surface.
- Hub installs record the installed content hash. Reinstalling an edited skill
  conflicts unless `force` is set; available entries report `edited` and
  `updateAvailable`.
- Seeded `tavern-agent` and `visuals` skills can be reset through
  `POST /skills/:id/reset`. Runtime also refreshes changed seeded content when
  preparing managed skills.

Tool contract:

- Runtime-native tool ids remain distinct from provider transport names.
- Tool enablement separates operator choice from Runtime usability.
- Runtime may report built-in tools as `readOnly` inventory facts.
- Browser and `web_fetch` are host tools with exact per-agent grants.
- MCP tools are granted by connection id and upstream tool name. Discovery
  never grants a newly reported tool.
- MCP connection configuration and credentials belong to Connections, not
  skills. Runtime tool details remain diagnostics rather than copied skill
  instructions.

See [Connections API](connections.md) for MCP routes and credential boundaries.
