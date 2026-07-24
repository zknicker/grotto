# Tavern

Tavern is a local agent workspace that renders durable chat, agent execution, and app-owned UI
from typed runtime contracts.

This file defines stable product language. It is not a docs index; run `bun run docs:list` to pick
the docs to read before changing behavior.

## Language

**Chat**:
A durable Tavern conversation container, shaped like a channel or DM, where humans, agents, system
actors, and external actors can participate.
_Avoid_: Agent session, thread, executor channel, transcript

**Channel**:
A named multi-participant Chat in a Tavern workspace.
_Avoid_: Room, group chat

**DM**:
A one-to-one Chat between two participants.
_Avoid_: Private channel, direct channel

**Chat participant**:
One actor with membership in a Chat, such as a human user, Tavern agent, system actor, or external
identity.
_Avoid_: Worker, sender, runtime identity

**Agent seat**:
An agent Chat participant in a specific Chat, owning that agent's current session binding for the
Chat.
_Avoid_: Agent presence, session key, runtime route

**Agent session**:
The rotatable execution continuity record for an Agent seat.
_Avoid_: Chat, seat, runtime session

**Agent turn**:
One execution attempt by an Agent seat inside an Agent session.
_Avoid_: Agent run, Chat, session

**Agent workspace**:
The per-agent filesystem home that stores that agent's editable identity, instructions, briefing
files, episodic observations, generated files, and working state.
_Avoid_: Wiki root, Runtime storage root, provider home

**Active turn stream**:
Transient Runtime state for an in-progress Agent turn, used for live updates before durable Chat
messages and activity are complete.
_Avoid_: Chat history, UIMessage array, browser request

**Agent executor**:
A small Runtime implementation boundary that turns an Agent turn request into Tavern turn events.
_Avoid_: Agent engine, provider adapter, harness wrapper

**Agent addressing**:
The rule that decides which agent participants should create Agent turns for a Chat message.
_Avoid_: Session routing, runtime routing, trigger parsing

**Model provider**:
A Runtime integration that can expose agent-executable models after the user enables it and completes
its access setup.
_Avoid_: Model family, provider option, model row

**Provider catalog**:
The maintained list of Model providers Tavern can add to a Runtime.
_Avoid_: Executable model list, enabled providers, provider credentials

**Enabled model provider**:
A Model provider the user has added to the Runtime. It may still need credentials, OAuth, CLI setup,
or host dependencies before it can execute turns.
_Avoid_: Connected provider, catalog provider, installed provider

**Provider access**:
The credential and host setup state for an Enabled model provider.
_Avoid_: Model capability, provider config, agent model

**Executable provider**:
An Enabled model provider whose Provider access is ready for Agent turns on the Runtime host.
_Avoid_: Catalog provider, connected provider, authenticated provider

**Model record**:
A catalog row for a concrete model route, including its model ref, display metadata, capabilities,
provider, and execution kind. A Model record is executable only when it belongs to an Executable
provider.
_Avoid_: Model alias, provider option, model family

**Executable model**:
A Model record that belongs to an Executable provider and can be used for Agent turns now.
_Avoid_: Available model, configured model, default model

**Agent runtime profile**:
An agent's selected Model record plus execution policies for tools, memory, and sandboxing.
_Avoid_: Provider config, harness config, model config

**Agent default model**:
The Model record stored on an Agent runtime profile and used when Runtime creates a new Agent
session.
_Avoid_: Global model, provider default, app default

**Effective model**:
The Model record an Agent session currently uses. Agent runtime profiles provide defaults, but
current model selection is session-scoped.
_Avoid_: Global agent model, provider setting

**Tool**:
A Runtime-visible executable action an agent may invoke during an Agent turn.
_Avoid_: Skill, MCP server, channel, Plugin

**Harness-native tool**:
A Tool supplied by the selected Agent executor's harness, such as local file, shell, search, or
provider-native subagent actions. Tavern may display these as provider facts, but does not own their
individual lifecycle.
_Avoid_: Tavern tool, Plugin action, MCP server

**Tavern host tool**:
A Tool implemented by Tavern Runtime and passed to the Agent executor, such as `web_fetch`,
browser control, Memory reads, chat sends, or other Tavern-owned product actions.
_Avoid_: Harness-native tool, raw Runtime route, MCP connection setting

**MCP connection**:
A Runtime-owned configured instance of an external Model Context Protocol server, including its
transport, authentication boundary, account identity, connection state, and discovered tools.
Multiple connections may target the same MCP server for different accounts. Runtime holds
credentials and relays granted calls without exposing credentials to agents.
_Avoid_: MCP server, Tool, Channel, Plugin

**MCP tool grant**:
An agent-level policy that allows one exact upstream tool from one MCP connection during Agent
turns. Newly discovered tools are ungranted by default, and Runtime rechecks the grant immediately
before forwarding every call.
_Avoid_: Connection enablement, per-chat MCP setting, broad server grant

**Sandbox mode**:
The execution environment for an agent's tools and harness processes: none, Docker, or Podman.
_Avoid_: Approval mode, runtime prompt

**Local workspace sandbox**:
A Sandbox mode of none where Tavern gives an agent a host filesystem workspace under the Tavern data
root and runs child processes directly from that workspace.
_Avoid_: Secure sandbox, container, VM

**Assignable primitive**:
A Tavern capability that can be attached to an agent definition, such as a Skill, MCP tool grant,
host-tool grant, Memory namespace, or Channel membership.
_Avoid_: Runtime plugin, harness setting, bundled feature

**Installed skill**:
A reusable instruction package available in Tavern for assignment to agents.
_Avoid_: Assigned skill, enabled tool, marketplace item

**Skill assignment**:
An agent setting that references installed skills the agent should receive during turns.
_Avoid_: Skill install, skill discovery, global enablement

**Widget activity envelope**:
The durable `tavern.widget.<name>` render envelope that stores a Visual or Artifact fence in chat
history (ADR 0010). The retired closed widget catalog (tables, charts, calendars, html-preview)
replays as fallback-text cards.
_Avoid_: Rich Response, UI block, AG-UI component, ChatKit widget

**Visual**:
One bespoke model-authored HTML/SVG graphic rendered from a `visual` fence in a sandboxed inline
frame styled with Tavern theme tokens.
_Avoid_: Rich Response, custom widget, raw HTML block

**Visuals skill**:
The seeded skill that owns rendering guidance for agents: when to render, the visual and artifact
fence contracts, and the design system (ADR 0012).
_Avoid_: Prompt design section, page-design skill, per-medium design skills

**Artifact**:
A durable Runtime-owned output that can be rendered, reopened, and referenced from chat.
_Avoid_: Preview, attachment, tool result, generated file

**Artifact Panel**:
The app-owned side surface where users open and inspect Artifact Panel targets beside chat.
_Avoid_: Workbench, browser shell, output pane, Artifact Space

**Artifact Panel target**:
A Tavern-owned openable target such as a chat Artifact, Wiki page, workspace file, image, or
generated asset.
_Avoid_: Local path, browser URL, tool result blob

**Artifact pane**:
One open view inside the Artifact Panel, backed by one Artifact Panel target.
_Avoid_: Tab content, preview card, drawer

**Artifact open action**:
A user action that opens an Artifact pane from a chat row, activity row, or linked inspectable
output. Tavern does not auto-open the Artifact Panel when targets are created.
_Avoid_: Canvas trigger, automatic artifact presentation, artifact launch

**Inspectable output**:
A workspace file, Wiki page, Markdown or HTML doc, image, or generated asset an agent created or
updated for the user to inspect.
_Avoid_: Tavern resource, tool result, attachment

**Host adapter**:
A small adapter file in Runtime, Server, or Website that connects a Widget contract to that
layer's existing event, projection, or rendering pipeline.
_Avoid_: Widget implementation, plugin loader

**Surface component**:
A normal Tavern App React component used to render validated Widget props with the app's shared
visual system.
_Avoid_: Model component, widget primitive

**Memory**:
Tavern's per-agent durable context system: briefing files, episodic observations, and background
workers that keep those files useful.
_Avoid_: Wiki, vault, knowledgebase, prompt-time memory

**Wiki**:
The shared user-owned Markdown graph for durable cross-agent knowledge. Agents browse and maintain it
through `wiki_*` tools.
_Avoid_: Memory, vault, prompt briefing, episodic log

**Wiki root**:
The filesystem directory that stores the shared Wiki Markdown files and local Git history.
_Avoid_: Runtime storage root, managed workspace, workbench

**Agent briefing file**:
An agent-owned startup briefing file in the Agent workspace, such as `MEMORY.md` or `USER.md`,
loaded into that agent's prompt and refreshed from Memory by background workers.
_Avoid_: root-level briefing files, Vault page

**Agent briefing layer**:
The Layer 1 Memory layer made from an Agent workspace's `USER.md` and `MEMORY.md` files.
_Avoid_: Wiki root, shared Wiki page, episodic Memory

**Episodic Memory**:
The per-agent Layer 2 Memory layer of background-extracted observations from chats, turns, and
external events before they are promoted into stable knowledge.
_Avoid_: Chat transcript, assistant briefing, Wiki page

**Memory dreaming**:
The background Memory maintenance pass that reviews Episodic Memory, promotes stable knowledge to
the Wiki, and refreshes Agent briefing files.
_Avoid_: Extraction, summarization, compaction

**Wiki surface**:
The Tavern Runtime-owned access surface for the Wiki root: path resolution, safe reads, writes,
moves, deletes, backlinks, freshness, and status.
_Avoid_: Vault API, Memory browser, ingestion system, maintenance job

**Charts**:
The Widget family for agent-authored chart displays.
_Avoid_: Chart kit

**Calendar displays**:
The Widget family for agent-authored calendar event and calendar day displays.
_Avoid_: Calendar widget tools
