---
summary: Skills teach agents; host and MCP tools let agents act.
read_when:
  - changing skill inventory, global enablement, assignment, or tool grants
---

# Skills and Tools

Skills are installed instruction packages. Installing and assigning are
separate operations. A globally enabled skill may be assigned to any agent.
Disabling a skill warns which agents are affected and permanently removes those
assignments; re-enabling does not restore them.

Tools are executable capabilities:

- Harness and Runtime tools follow their existing execution policy.
- Browser and `web_fetch` are host tools with explicit agent grants.
- External service tools come from MCP connections and are granted individually
  by connection and upstream tool name.

Agent profiles expose Skills and Tools as separate tabs. Connections are
configured in Settings -> Connections; tool access is configured on the agent.
Skills never carry credentials and MCP connections never install skills.

## Contract

Tavern should not invent a product primitive called a toolset. The agent engine
configures executable capabilities through concrete Runtime tools, host tools,
and MCP connections. Tavern may group tools for display, but the Runtime
contract stays concrete.

Skill install and skill assignment are separate operations. Installing a skill
copies or imports a skill package into Runtime's installed skill library. The
installed skill then appears in inventory, can be previewed through `skill.get`,
and can be assigned to one or more agents. Assigning a skill stores that
agent's enabled skill ids; it does not copy the skill package.

Agents can author skills into the same shared library. Agent-authored skills
are auto-enabled for the creating agent, visible to other agents on the Skills
settings page, and assigned to other agents through normal skill enablement.
Agents can edit only skills they created. Seeded, hub-installed,
operator-placed, and other agents' skills are read-only on the agent surface.
Managed seeded and hub skills show available-update state. Seeded skills can be
restored to Tavern's current version, and Runtime refreshes their managed
content when preparing them.

Hub-installed skills record the hash Tavern wrote at install time. Reinstalling
an unedited hub skill replaces it cleanly. Reinstalling a skill whose local
content differs from that installed hash reports a conflict unless the caller
forces the reinstall. The hub inventory reports both local edits and whether the
bundled hub version differs from the installed hash.

The seeded `tavern-agent` and `visuals` skills are created when missing and
refreshed when their content differs from the current Tavern defaults. Other
skills do not have Tavern defaults. Task guidance is taught by the composed
agent prompt (grotto CLI task verbs), not a seeded skill.

Agent-authored skills have a lifecycle. Runtime marks unused agent-created
skills stale after 30 days and archives them after 90 days by moving the whole
package into the library archive and disabling assignments. A weekly idle
curator uses the Deep model category to consolidate overlapping agent-authored
skills into class-level skills, archive absorbed or irrelevant packages, and
record an audited curation report.

At execution time, Runtime resolves the agent's enabled skill ids against the
installed skill library. Agents receive matching skill bundles through the AI
SDK `HarnessAgent` `skills` setting. Missing assigned skills are stale settings
and are ignored instead of failing unrelated chat work. Runtime does not copy
assigned skill content into `system` instructions.

Agent-authored and hub-installed skill updates are explicit agent or user work.
Tavern refreshes seeded skills as managed artifacts; durable custom doctrine
belongs in a separate skill.

Tool exposure is Runtime work. Harness tools come from the selected executor
and are governed by sandbox and approval policy. Browser and `web_fetch` are
host tools with explicit per-agent grants. MCP tools are discovered from
Connections and granted by exact connection id and upstream tool name. New
upstream tools remain ungranted.

Provider-specific transport adapters do not create new user-visible tools. For
example, Claude Code receives Tavern tools through a generated MCP bridge
because that provider requires MCP for executable custom tools. Settings still
shows the Runtime-owned tool name rather than the provider transport name.

## Sources

| Source | Shows as | Notes |
| --- | --- | --- |
| Installed skill library | Skill | Runtime-reported skill packages under Runtime's installed skill library. |
| Built-in skill library | Available skill | Optional skills vendored with Runtime. Installing one copies it into the installed skill library. |
| Skill taps | Available skill | User-added GitHub repos with skill packages. Runtime lists, previews, scans, installs, and uninstalls them. |
| Authored tools and defaults | Tool | Executable actions available to the agent. Risk is controlled by sandbox and approval policy. |
| Dynamic tools | Tool | Runtime- or session-resolved tools. |
| Host tools | Tool | Runtime-owned Browser and `web_fetch` capabilities with exact agent grants. |
| MCP connections | Connection and Tool | Settings -> Connections owns server accounts; agent profiles own exact discovered-tool grants. |
| Channels | Channel | Frontends that can create or continue agent sessions. Managed from Settings -> Channels. |

## Runtime Boundary

Runtime is the source of truth for skill inventory, assignments, host-tool
grants, MCP connections, MCP discovery, exact MCP grants, channel bindings, and
agent materialization. It stores connection secrets, invokes upstream MCP
servers, and never exposes credentials to agents. The app renders these
contracts through Tavern API and does not write agent project files directly.

## Missing on Purpose

- A Tavern skill marketplace.
- A Tavern-owned skill version manager.
- A generic toolset product surface.
- A global Settings -> Tools page. Tool grants live on each agent profile.
- Showing channels as MCP connections.
