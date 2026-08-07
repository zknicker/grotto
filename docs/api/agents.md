---
summary: Agent records and configuration API for models, skills, host tools, MCP tool grants, and runtime metadata boundaries.
read_when:
  - changing agent records, instructions, personality, model settings, or per-agent skill and tool controls
  - changing how clients list, configure, or address agents
---

# Agents API

The Agents API is for the workers users configure and talk to in Grotto.

Agents are client-facing records. Runtime sessions and execution details
can be attached as metadata, but the API exposes agents as named Grotto workers
with instruction settings, model, execution, skill assignment, and tool grant
policy.

## Contract

* Agent ids are durable Grotto ids hosted by Grotto Runtime.
* Runtime bootstraps `agt_primary`, and clients can create, list, configure,
  and address additional agents.
* Each Runtime-managed agent owns one built-in Grotto DM with the local human
  operator. Clients reuse that DM instead of creating additional direct chats
  for the same agent.
* Agent list and detail reads use synced Runtime records. Mounting an app screen
  must not contact the agent runtime or enqueue a background sync job just to
  discover agents.
* Agent records expose display name, bio, model policy, skill selections,
  workspace folder, and availability. Exact MCP and host-tool grants are
  separate Runtime-owned records keyed by agent.
* The bio is a short Runtime-owned job description (max 280 characters,
  nullable). Runtime injects each agent seat's bio into the participant roster
  of every agent turn prompt in shared chats, so co-resident agents know what
  each agent is for.
* Agent appearance is one uploaded square image or nothing at all. Hosted
  records expose `avatarUrl`, a URL the app puts straight into an `<img src>`;
  local records expose the runtime's inline `avatarUrl`. Surfaces with no
  avatar fall back to initials. The agent profile still carries a primary
  color, which is a name label only and does not tint the avatar.
* Skill selections are ids of installed Runtime skills. Runtime resolves those
  ids during execution and passes the matching skill bundles through the AI SDK
  skill surface for executors that support it. Skill content is not appended to
  the agent instruction text.
* Model availability comes from model options exposed through Runtime.
  Clients read the stored snapshot and capability state instead of maintaining a
  Grotto-maintained list.
* Model records include the Runtime execution kind. All supported agent model
  rows execute through the harness route; OpenAI API-key rows use the Pi
  harness adapter.
* Skill assignments and exact MCP and host-tool grants are inspectable before
  a run starts. Harness-native tools are executor facts governed by sandbox
  and approval policy, not Grotto grants.
* Assignment requires global availability. Skill saves reject newly assigned
  skills that are globally disabled or missing setup. Globally disabling a
  skill removes its current agent assignments after user confirmation.
* MCP grants identify one connection and one upstream tool name. Discovery
  never grants a new tool. Runtime checks the grant again immediately before
  every upstream call.
* Browser and `web_fetch` are host tools with explicit grants. New agents get
  `web_fetch` by default; Browser remains ungranted until selected.
* Instruction settings use markdown source files. Runtime composes the system
  prompt from Grotto-managed instruction text plus the agent's description
  (the personality surface); it does not materialize a generated `AGENTS.md`
  file in the workspace. There is no separate identity file — durable
  per-agent notes are the agent's own workspace files (`MEMORY.md` and
  notes/), which it maintains itself. Clients save source files through the
  Runtime-hosted agent file API. The rendered system prompt is readable for
  preview through the instructions read surface.
* Workspace list and read inputs accept `includeHidden` (default `false`).
  This choice is carried through the Server↔Computer relay; it never weakens
  the sensitive-file or skipped-directory boundary.
* Agent settings use narrow domain mutations. Clients update agent
  name, bio, model, thinking default, and messaging bindings through agent and
  messaging APIs instead of editing or saving raw engine config JSON.
* Web settings store each agent's provider-native web-search opt-in
  (`webAccessEnabled`, default off) via
  `PATCH /agents/{id}/web-settings`. The separately granted Runtime
  `web_fetch` host tool is not controlled by this flag. The `webAccess`
  Runtime capability gates the native-search setting.
* Instruction-affecting settings (name, bio, description) apply per session:
  executors receive instructions once at a session's first turn, so changes
  land when the next session starts. The current-session read returns
  `instructionsFresh` so clients can flag a live session running on earlier
  instructions; settings surfaces say "Takes effect on each agent's next
  session" on save.
* Persisted agent settings mean user intent. Runtime startup can apply Grotto
  defaults to the managed engine, but it must not write those defaults into the
  saved agent settings store.
* Agent environment variables are Runtime-stored secrets exposed to the local
  settings UI. The home timezone is a runtime-wide setting, not an agent
  setting. Model fallback chains, web page summarizer models, context
  compression, and subagent defaults are intentionally not exposed until the
  local agent engine supports them.
* Runtime execution state is not required just to list agents.

## Surface

The API covers:

* list agents
* get an agent
* list an agent's Grotto and external runtime chat references
* create agents
* delete agents
* update agent settings
* read and update supported agent markdown files
* read model choices and availability
* read and update agent environment variables
* read and update skill assignment
* read and update exact MCP and host-tool grants
* read generated instruction status when exposed for diagnostics
* read agent presence (busy/idle), the activity feed, and read-only inbox
  visibility (pending targets, mutes, followed threads)
* stop an agent's running turn

For hosted Servers, `agent.list` owns the active roster and `agent.get` owns one
profile record. Clients keep list membership separate from profile detail so a
detail surface can refresh one Agent without rebuilding unrelated profile
state.

## Runtime Boundary

Grotto Runtime owns native execution, tool invocation, model calls, files, and
sessions. Runtime also owns the first-class agent records, user-editable
agent controls, and the chat state where agents participate. Grotto App reads
those records through tRPC/React Query and may keep app-owned presentation
overlays, but the app database is not the source of truth for agent existence.
When a client creates an agent without a workspace folder, Runtime assigns the
workspace under its data root.

Runtime words such as `session`, `turn`, and `run` appear only where the API is
returning execution metadata for a specific agent activity.

`agent.chats.list` is the agent-scoped chat inventory for agent pages. It
combines Grotto chats bound to the agent with Runtime-owned external chat
references such as Discord channels. External chat references are read-only
evidence surfaces; they do not appear in the global Grotto sidebar chat list.

## Related Docs

* [Agents feature](../features/agents.md)
* [API overview](overview.md)
* [Grotto Runtime](../internals/runtime.md)
