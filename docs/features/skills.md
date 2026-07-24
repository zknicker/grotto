---
summary: Skills and Tools feature for reusable agent skills, executable tools, built-in Plugins, and advanced MCP plumbing.
read_when:
  - changing skill catalog, setup blockers, runtime tools, built-in Plugins, MCP plumbing, or agent access
  - changing how runtime-visible skills, tools, or Plugin capabilities become available to the agent
---

# Skills and Tools

Skills and Tools answer different questions.

* **Skills** teach the agent how to do work. They are agent-engine skill files
  or packages and are loaded on demand by Runtime.
* **Tools** let the agent do work. They are execution facts from the selected
  harness, Runtime, Plugins, or advanced MCP plumbing, not a standalone settings
  page.
* **Channels** are places where humans can talk with Tavern agents, such as
  Tavern chat, Discord, Telegram, or another frontend.
* **Plugins** are built-in Tavern integrations that own settings, secrets,
  health, agent tools, skills, channels, hooks, or other Runtime capability.
  Users manage external service integrations from Settings -> Plugins.
* **MCP** is advanced Runtime plumbing. MCP servers may back a Plugin or a
  development experiment, but raw MCP server setup is not the default
  user-facing integration path.

## In the Box

* **Skills page.** Settings -> Agents -> Skills enables or disables
  Runtime-visible skills for one agent. The skill inventory browser still reads
  installed and available skills, renders `SKILL.md`, and shows source, setup
  status, and install or uninstall actions where supported.
* **Plugins page.** Configure built-in Tavern integrations. Plugin tools and
  skills become available through Plugin enablement, Service enablement, and
  Plugin grants.
* **Advanced MCP page.** Direct MCP server records may be inspected or edited
  for internal development and Plugin-backed experiments, but Plugins are the
  normal product surface.
* **Channels page.** Inspect the frontends connected to the managed agent.
  Tavern chat is always present; external channels are runtime bindings.

## Contract

Tavern should not invent a product primitive called a toolset. The agent engine
configures tools through authored files, default-tool overrides, dynamic tool
resolvers, Plugin materialization, and advanced connection records. Tavern can
group tools for display, but the Runtime contract should stay concrete: skills,
tools, channels, built-in Plugins, and advanced MCP records.

Skill install and skill assignment are separate operations. Installing a skill
copies or imports a skill package into Runtime's installed skill library. The
installed skill then appears in inventory, can be previewed through `skill.get`,
and can be assigned to one or more agents. Assigning a skill stores that
agent's enabled skill ids; it does not copy the skill package.

Agents can author skills into the same shared library. Agent-authored skills
are auto-enabled for the creating agent, visible to other agents on the Skills
settings page, and assigned to other agents through normal skill enablement.
Agents can edit only skills they created. Seeded, hub-installed, Plugin,
operator-placed, and other agents' skills are read-only on the agent surface.
Managed seeded, hub, and Plugin skills show available-update state and can be
restored to Tavern's current version. Seeded skills are managed artifacts:
Runtime replaces local edits with its current defaults when it prepares them.

Hub-installed skills record the hash Tavern wrote at install time. Reinstalling
an unedited hub skill replaces it cleanly. Reinstalling a skill whose local
content differs from that installed hash reports a conflict unless the caller
forces the reinstall. The hub inventory reports both local edits and whether the
bundled hub version differs from the installed hash.

The seeded `tavern-agent` and `visuals` skills are created when missing and
refreshed when their content differs from the current Tavern defaults. Other
non-Plugin skills do not have Tavern defaults. Task guidance is taught by the
composed agent prompt (grotto CLI task verbs), not a seeded skill.

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

Tool exposure is Runtime work. Harness tools come from the selected executor and
are governed by sandbox and approval policy. Plugin tools come from built-in
Plugin enablement, Service enablement, and the agent's Plugin grant. Tavern does
not expose a Tools page or user-facing tool-grant editor in v1.

Provider-specific transport adapters do not create new user-visible tools. For
example, Claude Code receives Tavern tools through a generated MCP bridge
because that provider requires MCP for executable custom tools. Settings still
shows the Runtime-owned tool (`bash`, `read_file`, or a Plugin tool), not the
provider transport name (`mcp__tavern__bash`).

## Sources

| Source | Shows as | Notes |
| --- | --- | --- |
| Installed skill library | Skill | Runtime-reported skill packages under Runtime's installed skill library. |
| Built-in skill library | Available skill | Optional skills vendored with Runtime. Installing one copies it into the installed skill library. |
| Skill taps | Available skill | User-added GitHub repos with skill packages. Runtime lists, previews, scans, installs, and uninstalls them. |
| Authored tools and defaults | Tool | Executable actions available to the agent. Risk is controlled by sandbox and approval policy. |
| Dynamic tools | Tool | Runtime- or session-resolved tools. |
| MCP servers | Advanced MCP record | Runtime connection records that may expose tools through MCP. Hidden from normal agent setup; Plugins are preferred. |
| Channels | Channel | Frontends that can create or continue agent sessions. Managed from Settings -> Channels. |
| Tavern Plugins | Plugin, Skill, or Tool | Built-in Plugins own enablement, then Runtime compiles their bundled skills and tools into the agent project. |

## Runtime Boundary

Runtime is the source of truth for skill inventory, tool inventory, MCP server
records, channel bindings, Plugin contributions, and agent materialization.
The app reads those records through Tavern API and renders settings for
assignable capabilities. The app does not write agent project files directly.

MCP servers are stored as Tavern Runtime records with redacted secrets when
needed for advanced development or Plugin-backed integration plumbing. Runtime
materializes enabled MCP servers for the agent engine. Runtime then handles tool
discovery, credential use, sandboxing, and durable execution.

Plugins stay owned by Runtime. A Plugin may contribute bundled skills or tools,
but agent access is controlled by Plugin grants, not by direct skill or tool
row toggles.

## Missing on Purpose

* A Tavern skill marketplace.
* A Tavern-owned skill version manager.
* A generic "toolset" product surface.
* A Settings Tools page.
* User-facing Tool grants.
* Showing MCP servers as tools.
* Showing channels as MCP servers.
