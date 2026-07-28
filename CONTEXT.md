# Tavern

Tavern is a local agent workspace that renders durable chat, agent execution, and app-owned UI
from typed runtime contracts.

This file defines stable product language. It is not a docs index; run `bun run docs:list` to pick
the docs to read before changing behavior.

## Language

**Grotto server**:
The durable top-level collaboration container that owns Chats, members, agents, reminders, tasks,
attachments, and other shared product state. A human may belong to multiple independent Grotto
servers.
_Avoid_: Runtime, Computer, workspace, deployment

**Server slug**:
The globally unique, immutable human-facing address chosen when a Grotto server is created. Server
relationships and authorization use the stable Server id instead.
_Avoid_: Server name, Server id, invitation code

**Grotto App**:
The web client through which humans use one or more Grotto servers. The Electron distribution is an
optional native shell around the same client, not a separate product backend.
_Avoid_: Grotto server, Grotto Computer, local app server

**Computer**:
A Server-scoped attachment of a physical machine that runs Agent sessions and Agent turns and
stores its Agents, workspaces, skills, queues, and execution credentials. None of those resources
can be referenced or used across Computers, including attachments on the same physical machine.
MCP connections and grants belong to Grotto Server instead. A Grotto server may have multiple
Computers; one physical machine may have a separate Computer attachment in multiple Grotto
servers. The physical installation shares only installed software and native runtime/model access.
_Avoid_: Grotto server, tenant, Grotto Computer installation, agent runtime, model provider

**Grotto Computer**:
The local service installation that connects a physical machine to zero or more Grotto servers and
supervises each Server-scoped Computer attachment independently. One resident OS service supervises
one isolated child runner per attachment; each child owns only that Server's credential, socket,
and Agent processes. WS6 supports Apple Silicon macOS only and installs the resident service with
launchd.
_Avoid_: Grotto server, Computer attachment, Agent runtime, tenant

**Grotto CLI**:
The agent-facing `grotto` command that acts on one Grotto server through the managed Agent's local
Grotto Computer proxy. For managed Agents it is bundled inside the installed `grotto-computer`
artifact and exposed through an injected wrapper; it is not a separately installed npm package.
_Avoid_: Grotto Computer CLI, human administration CLI, local service

**Grotto Computer CLI**:
The human-operated `grotto-computer` command that installs, attaches, inspects, and controls Grotto
Computer on a physical machine. Its release artifact also embeds the managed Grotto CLI
implementation behind an internal entrypoint. `setup` performs inline device authorization and is
the only attachment flow; there is no persistent human CLI session or `login`, `logout`, or
standalone `attach` command. Re-running `setup` reuses a valid local attachment and fails closed
rather than replacing an attachment whose credential is rejected. Setup is additive across
Servers: adding another Server starts another isolated runner without stopping existing runners.
Stopping Grotto Computer is temporary and preserves every attachment; permanent Computer removal
is an App action, not a CLI detach operation. A manual `stop` persists across machine restarts
until an operator explicitly runs `start`; otherwise the installed OS service starts
automatically at boot.
_Avoid_: Grotto CLI, Agent tool, hosted Server administration

**Computer update**:
An operator-triggered upgrade of the installed Grotto Computer service. The service reports its
current version and update state to every attached Server. Owners and Admins initiate updates from
the App's Computer settings; the Server sends a typed update command to the online Computer, which
stages the signed release, restarts, and reconnects. Updates never install automatically during
ordinary startup. Because the resident service is shared, any attached Server's Owner or Admin may
trigger the update and every attachment observes the restart. Other Servers receive no initiating
Server or User identity. The Computer downloads and verifies while turns continue, then stops
admitting new turns, waits for active turns to finish, restarts, and resumes queued work. A stuck
Agent must be explicitly stopped; updates never force-interrupt a turn. `grotto-computer upgrade`
is the local recovery path. Grotto publishes one production Computer release stream; there are no
release channels or pinned tracks, and every normal update targets the latest release.
_Avoid_: App update, automatic update, Agent runtime change, protocol fallback

**Computer install root**:
The disposable, versioned location containing the installed Grotto Computer executable and its
embedded managed Grotto CLI. npm installation and Computer updates may atomically replace this
root, but never write to the Computer data root. It lives under the npm installation prefix with
the `grotto-computer` executable exposed on `PATH`; it is never inside `~/.grotto`.
_Avoid_: Computer data root, Agent workspace, attachment state

**Computer data root**:
The stable, version-independent local root containing Computer identity, Server attachment state,
delivery queues, logs, and Agent workspace directories. It is outside npm package and executable
locations. Updates drain Agents before changing code and never replace, recursively clean, or
relocate this root. The updater does not snapshot the data root or Agent workspaces; small
Computer-owned records use atomic writes, and local schema changes are transactional. Its canonical
path is `~/.grotto`; resident service state lives under `computer/`, while each attachment owns
`computer/servers/<server-id>/` with its credential, vault, queues, and
`agents/<agent-id>/{home,skills,workspace,runtime}/` directories. npm uninstall removes only
installed code; it never deletes this root. Reinstalling resumes every still-valid attachment and
workspace.
_Avoid_: Computer install root, npm package directory, application bundle

**Computer model access**:
The physical machine's shared installed runtimes, model inventory, subscriptions, and provider
sessions. Every Server attachment receives sanitized availability and health, and its Owners and
Admins may assign Agents to available models. Grotto only detects these native runtime sessions:
provider setup and login happen through each runtime's own local flow, and Grotto never accepts,
stores, or relays provider credentials. Attaching a Server explicitly authorizes this shared paid
compute capacity, matching Raft's reuse of host runtime logins such as Codex OAuth.
_Avoid_: Server-owned model credential, per-Agent provider login, hosted provider secret

**MCP connection**:
A Server-owned configured account on one remote HTTP MCP server. Grotto Server stores its
credentials, OAuth state, discovered tools, connection-level Agent grants, and client sessions.
Computer receives only safe tool schemas and returns granted calls through a scoped runner
credential. Reusing an external account on another Server requires a separate connection.
_Avoid_: Computer-owned integration credential, local MCP process, stdio connection

**MCP OAuth attempt**:
A short-lived Server-owned authorization flow for one MCP connection. Grotto Server creates and
retains PKCE and routing state, validates the hosted callback, exchanges the one-time code, and
stores and refreshes tokens. Computer does not participate.
_Avoid_: Computer callback relay, Agent-visible token, durable authorization code

**Computer bootstrap protocol**:
The minimal stable handshake through which a Computer authenticates and reports its binary and
protocol versions before entering the versioned Computer protocol. An incompatible Computer may
remain connected in `update-required` mode only, allowing signed update control and progress
reporting but no Agent execution, delivery, or ordinary control. A Computer too old for the
bootstrap protocol requires local `grotto-computer upgrade`.
_Avoid_: Computer protocol, backward-compatible Agent protocol, version fallback

**Agent proxy credential**:
A narrow local credential that lets one managed Agent use its Grotto Computer proxy as itself for
one Server attachment. It has no authority when presented directly to a Grotto server.
_Avoid_: Computer credential, external Agent credential, human session

**Agent runner credential**:
A scoped, revocable Server credential minted to Grotto Computer for one managed Agent launch.
Grotto Computer keeps it behind the localhost proxy and revokes it when the launch ends; the
Agent process and shell never receive it.
_Avoid_: Agent proxy credential, external Agent credential, Computer credential, provider credential

**Computer credential**:
A revocable credential issued by one Grotto server after single-use, expiring, human-approved
device authorization during `grotto-computer setup`. It authenticates one Computer attachment's
outbound connection and grants no human or cross-Server authority. The temporary human
authorization is discarded after exchange; Grotto Computer stores no human session. The
credential is stored in an atomic, mode-`0600` attachment file under the Computer data root, not
macOS Keychain.
_Avoid_: Human session, Agent credential, provider credential, shared Runtime token

**Server member**:
A human User or Agent with standing access to one Grotto server. Server membership governs
server-wide identity and role; participation in a specific Chat is a separate relationship.
_Avoid_: Chat participant, Clerk user, Computer, external actor

**User**:
A persistent human identity in Grotto that may hold membership in multiple Grotto servers. Clerk
authenticates the human and supplies an external identity reference but does not own the User.
_Avoid_: Server member, Chat participant, Clerk user, local operator

**Server role**:
A Server member's authority within one Grotto server: Member, Admin, or Owner. Humans and Agents
may be Members or Admins; only humans may be Owners. A Grotto server has one or more Owners, and
its last Owner cannot leave, be removed, or be demoted.
_Avoid_: Chat role, agent specialty, global user role

**Server invite**:
A Server-owned, email-bound, single-use invitation that lets one Clerk-authenticated human become a
Member of one Grotto server before it expires. Administrative roles are assigned only after the
human joins.
_Avoid_: Clerk invitation, reusable join link, Server membership

**Agent**:
A persistent non-human Server member whose collaboration identity belongs to one Grotto server.
An Agent is created on one Computer, where its workspace and execution state live; that assignment
never changes. An offline Computer leaves the Agent offline, and the Computer cannot be removed
until the Agent is explicitly deleted.
_Avoid_: Agent session, Agent turn, executor, Computer

**Agent execution configuration**:
The Grotto server's immutable Computer assignment plus desired executor, model reference, execution
policy, Server-owned MCP connection grants, and lifecycle state for an Agent. Humans may edit this desired
state while the Computer is offline using its last reported inventory. The Computer applies the
current snapshot after reconnect and reports any unavailable local reference as degraded instead
of substituting it. A stopped lifecycle state persists until a human starts the Agent and
suppresses automatic wake without discarding pending work.
_Avoid_: Effective execution state, provider credentials, executable model inventory

**Effective execution state**:
Computer-reported facts about an Agent's current executor, model, session, process, capability
health, and failures. A Computer reports unsatisfied configuration instead of silently substituting
another executor or model.
_Avoid_: Agent execution configuration, Server policy, cached App state

**Reported execution snapshot**:
The Grotto server's latest persisted report of a Computer's effective execution state. It serves
routine App reads without contacting the Computer and may be labeled stale when reports stop.
_Avoid_: Desired configuration, live Computer query, execution trace

**Turn summary**:
A Grotto server record of one Agent turn's trigger, timing, outcome, effective model, usage totals,
and short failure category, excluding prompts, tool details, transcripts, and files.
_Avoid_: Execution trace, Chat message, model-context compaction

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
The rotatable execution continuity record for an Agent seat. An Agent has at most one current
session across all Chats. Changing its runtime or model starts a fresh session generation while
preserving the Agent's identity, workspace, memory, and skills. A runtime resume failure also
rotates automatically with explicit recovery evidence rather than leaving the Agent stuck on
unusable context.
_Avoid_: Chat, seat, runtime session

**Agent turn**:
One execution attempt by an Agent seat inside an Agent session.
_Avoid_: Agent run, Chat, session

**Agent workspace**:
The Computer-local per-Agent filesystem home that stores the Agent's editable identity,
instructions, briefing files, episodic observations, generated files, and working state. The
Grotto server does not cache it; authorized App reads use a live Computer relay and are unavailable
while that Computer is offline. Only human Server Owners and Admins may inspect it through the App.
_Avoid_: Server attachment storage, Wiki root, provider home

**Agent runtime home**:
The Grotto-managed logical `HOME` seen by one Agent's executor. It lives beside that Agent's
workspace inside its Computer attachment and contains only per-Agent executor state. Its
executor-native skill locations, including `.agents/skills` for Codex and Pi and `.claude/skills`
for Claude Code, resolve to the Agent skill library beside it. The executor does not discover the
operator's global skill folders. It is not a macOS account, the operator's home, or a
provider-credential store. Runtime-specific references or environment injection let the executor
reuse the physical machine's native provider session without copying that credential into Grotto
state.
_Avoid_: Agent workspace, host home, Computer data root, global skill folder

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
A Grotto Server-owned configured instance of a remote HTTP Model Context Protocol server,
including authentication, account identity, connection state, and discovered tools. Multiple
connections may target the same server for different accounts. Server invokes granted calls
without exposing credentials to Agents or Computers.
_Avoid_: local process, stdio transport, Tool, Channel, Plugin

**MCP tool grant**:
An Agent-level policy that enables one whole MCP connection during Agent turns. Every current tool
on that connection becomes available, and Server rechecks the connection grant immediately before
forwarding every call.
_Avoid_: Per-tool switch, per-chat MCP setting, global grant

**Sandbox mode**:
The execution environment for an agent's tools and harness processes: none, Docker, or Podman.
_Avoid_: Approval mode, runtime prompt

**Local workspace sandbox**:
A Sandbox mode of none where Tavern gives an agent a host filesystem workspace under the Tavern data
root and runs child processes directly from that workspace.
_Avoid_: Secure sandbox, container, VM

**Assignable primitive**:
A Tavern capability that can be attached to an agent definition, such as an MCP tool grant,
host-tool grant, Memory namespace, or Channel membership. Skills are local Agent files, not
assignable primitives.
_Avoid_: Runtime plugin, harness setting, bundled feature

**Agent skill library**:
The canonical, writable `skills/` directory owned by one Agent inside one Computer attachment.
The Agent may create, edit, or delete its skills through `grotto skill`; a human may explicitly
import a selected bundle from the physical machine into this directory while the Computer is
online. Its contents are the exact skill set exposed to every executor the Agent uses. Changing
the Agent's runtime or model never changes, copies, converts, or filters this library. The Computer
reports compact metadata—name, description, content hash, and modified time—to the Server for
offline App display. Skill bodies and supporting files remain Computer-local and require an
authorized live relay to view or edit.
_Avoid_: Global skill folder, disposable harness projection, skill assignment

**Skill import**:
An explicit online copy of one bundle from a runtime-compatible global skill folder on the physical
machine into one Agent skill library. Global folders are opt-in import sources only and are never
inherited or scanned by an Agent executor. Matching Raft's skill-list boundary, the Computer may
report importable names, descriptions, and shortened source paths to Server Owners and Admins in
the App, but bundle contents never transit or persist on the Server. **Import to Agent** performs
the copy entirely on the Computer. The imported copy has no synchronization or provenance
lifecycle and may be modified freely by the Agent.
_Avoid_: Skill assignment, shared catalog, global skill enablement

**Agent skill removal**:
A confirmed deletion of one bundle from one Agent skill library. It may destroy Agent-authored
adaptations, so the dialog names the Agent and skill and states that the Agent's copy will be
deleted. The import source and every other Agent library remain unchanged; there is no archive or
disabled copy.
_Avoid_: Import-source deletion, unassignment, global skill disablement

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
