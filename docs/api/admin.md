---
summary: Runtime admin and control routes for health, capabilities, events, agent execution, presence, activity, inbox, sessions, skills, models, bindings, and files.
read_when:
  - changing Tavern Runtime health, capabilities, admin, or control routes
  - changing agent execution, presence, activity, inbox, skills, sessions, or model runtime APIs
  - changing packages/tavern-api/src/runtime contracts
---

# Admin API

The Admin API is part of the Tavern API.

Tavern App, automations, local tools, and tests use it to inspect runtime
health, manage runtime-owned records, and control local runtime capabilities.
It is not a second product API.

## In The Box

- **Capabilities.** Runtime readiness, identity, version, compatibility, and
  feature health.
- **Runtime events.** Recent event lists and websocket notifications for
  operational state.
- **Agent execution.** Engine config, presence, activity, read-only inbox
  visibility, stop, and session reset.
- **Operational records.** Agents, sessions, jobs, models, skills, bindings,
  and agent files.
- **Runtime chat relay.** The private websocket Runtime uses for accepted chat
  work and agent dispatch. Durable chat history still lives in the Chat API.

## Route Groups

| Group                           | Routes                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Health and capabilities         | `/health`, `/capabilities`, `/capabilities/{id}`, `/capabilities/{id}/refresh`, `/capabilities/refresh`                                                                                                                                                                                                                                    |
| Runtime update                  | `/update/status`, `/update`, `/update/restart`                                                                                                                                                                                                                                                                                             |
| Runtime events                  | `/events`, websocket `/events`                                                                                                                                                                                                                                                                                                             |
| Agent execution                 | `/agent-engine/config`, `/agent-env`                                                                                                                                                                                                                                                                                |
| Agent presence, activity, inbox | `/agents/presence`, `/agents/{id}/activity`, `/agents/{id}/inbox`, `/agents/{id}/stop`, `/agents/{id}/session/reset`                                                                                                                                                                                                                       |
| Timezone settings               | `/timezone/settings`                                                                                                                                                                                                                                                                                                                       |
| Browser                         | `/browser/settings`, `/browser/open`, `/browser/restart`                                                                                                                                                                                                                                                                                   |
| Agents and files                | `/agents`, `/agents/{id}`, `/agents/{id}/config`, `/agents/{id}/files`, `/agents/{id}/files/{path}`, `/workspace/agents/{id}/files`, `/workspace/agents/{id}/files/{path}`                                                                                                                                       |
| Sessions and execution evidence | `/agent/sessions`, `/agent/sessions/previews`, `/agent/sessions/{sessionKey}/messages`, `/agent/sessions/{sessionKey}/graph`, `/agent/sessions/{sessionKey}/prompt`, `/agent/sessions/{sessionKey}/resync`                                                                                                                                 |
| Jobs                            | `/jobs`, `/jobs/{slug}`, `/jobs/{slug}/run`                                                                                                                                                                                                                                                                                                |
| Skills                          | `/skills`, `/skills/{id}`, `/skills/{id}/config`                                                                                                                                                                                                                                                                                           |
| Skill hub                       | `/skills/hub/available`, `/skills/hub/preview`, `/skills/hub/scan`, `/skills/hub/install`, `/skills/hub/uninstall`, `/skills/hub/taps`, `/skills/hub/taps/{repo}`                                                                                                                                                                          |
| Tools                           | `/tools`, `/tools/{id}/enabled`, `/tools/{id}/config`, `/tools/{id}/provider`, `/tools/{id}/env`, `/tools/{id}/post-setup`                                                                                                                                                                                                                 |
| MCP connections                 | `/mcp/connections`, `/mcp/connections/{id}`, `/mcp/connections/{id}/test`, `/mcp/connections/{id}/tools`, `/mcp/connections/{id}/disconnect`, `/mcp/connections/{id}/oauth/start`, `/mcp/connections/{id}/oauth/complete`, `/mcp/agents/{agentId}/grants`, `/mcp/agents/{agentId}/host-tools` |
| Models and access               | `/models`, `/model-categories/settings`, `/model-capabilities/selections`, `/model-providers/catalog`, `/model-providers/enabled`, `/model-providers/{providerId}`, `/model-access`, `/model-access/api-key`, `/model-access/oauth/{providerId}/start`, `/model-access/oauth/{providerId}/poll/{sessionId}`, `/model-access/oauth/{providerId}/submit`, `/model-access/oauth/sessions/{sessionId}`, `/model-access/openrouter` |
| Platform bindings               | `/bindings`, `/bindings/{id}`                                                                                                                                                                                                                                                                                                              |
| Runtime chat projections        | `/agent/chats`, `/agent/chats/{chatId}/messages`, `/agent/chats/{chatId}/agent-sessions/current`, `/agent/chats/{chatId}/pane-state`                                                                                                                                                                                              |
| Runtime chat relay              | websocket `/chat`                                                                                                                                                                                                                                                                                                                          |

`POST /jobs/{slug}/run` is the single manual job-run interface. Runtime job
definitions own their payload schema and default input.

`/agents/{id}/inbox` is read-only inbox visibility for the agent profile:
pending targets, muted channels, and followed threads (see
[Agent Inbox](../../specs/inbox.md)). `/agents/{id}/stop` is the agent-scoped
interrupt — it stops the agent's running turn and clears its queued backlog
wherever it is running, not a single chat's turn. Agents themselves reach
Runtime through a separate agent-token CLI surface (`/api/agent/*`, not this
admin surface) for sending, reading history, and pulling pending messages —
see [Agent Inbox](../../specs/inbox.md) and
[Grotto CLI](../../specs/grotto-cli.md).

`/timezone/settings` (GET/PUT) owns the runtime-wide home timezone (system
default when unset). Reads include the resolved effective timezone. Runtime
does not expose model fallback chains, web page summarizer models, context
compression, or subagent defaults until the local agent engine supports those
features.

`/agent-env` (GET/PUT) owns Tavern-stored environment variables for the managed
agent process. Values live in Tavern-managed secret storage; reads return saved
values for the local settings UI.

`/workspace/agents/{id}/files` and `/workspace/agents/{id}/files/{path}` expose
read-only browsing for the registered agent workspace. Paths are relative to
that workspace, traversal is rejected, hidden and generated dependency folders
are omitted from listings, and sensitive files such as `.env` and key material
are blocked. Tavern App uses these routes to preview linked workspace artifacts.

`/mcp/connections` owns Runtime-stored MCP connection records. Public
configuration is inspectable; credentials and secret headers stay in the
Runtime vault. A connection represents one account. Tool discovery is
read-only and never grants access. Per-agent grants identify the connection
and exact upstream tool name; Runtime checks them again at call time.
Disconnect clears credentials and grants. Custom connections may also be
deleted.

OAuth routes implement MCP authorization discovery, PKCE, refresh, and dynamic
client registration through the AI SDK MCP client. The App Server owns the
ephemeral loopback callback. Browser is a separate host-tool service with its
own settings and lifecycle routes.

`/model-providers/catalog` lists addable providers. `/model-providers/enabled`
lists the providers this Runtime has enabled. `/model-providers/{providerId}`
adds or removes one provider from the enabled set. `/models` returns executable
model inventory with each model's capability and execution kind.

`/model-categories/settings` (GET/PUT) stores agent model tier selections.
`/model-capabilities/selections` (GET/PUT) stores capability-scoped model policy;
an unset `imageGeneration` selection remains unset.

`/model-access/api-key` writes provider API keys through the Runtime model
access API. `/model-access/oauth/{providerId}/start` starts the provider OAuth
flow and returns either an auth URL or device-code instructions when Runtime
manages that provider's OAuth flow. External OAuth CLI providers return setup
instructions users can run on the Runtime host. Provider model credentials are
Runtime-owned.
Telemetry-only credentials, such as the OpenRouter management key used by
Stats, live with the feature that reads that telemetry.

## Contract Source

| Source                                              | Owns                                   |
| --------------------------------------------------- | -------------------------------------- |
| `packages/tavern-api/src/runtime/routes.ts`         | Admin route names                      |
| `packages/tavern-api/src/runtime/contracts.ts`      | Request and response schemas           |
| `packages/tavern-api/src/runtime/model-identity.ts` | Model provider and identity shapes     |
| `packages/tavern-api/src/runtime/skills.ts`         | Runtime skill file path helpers        |
| `apps/runtime/src/tavern/`                          | Runtime handlers                       |
| `@tavern/sdk`                                       | Typed client calls over the Tavern API |

## Rules

- **Runtime owns operations.** Health, capabilities, agent execution, sessions,
  and skill state come from Tavern Runtime.
- **Runtime owns capabilities.** Runtime stores capability health and exposes
  the capability API. Jobs and app surfaces can use capability health to decide
  whether dependent functionality is available. The app may cache and render
  capability health, but it does not run checks or decide readiness.
- **Runtime update is staged.** `/update` installs the new Runtime package
  without restarting the service. `/update/status` reports the stage state.
  `/update/restart` is the explicit cutover request and restarts the Homebrew
  service only after Tavern is ready to finish the whole app/Runtime update.
- **Read routes are Runtime-backed.** Agent, chat, model, skill, and session
  reads return the latest Runtime state. Runtime refreshes
  execution-owned records from specific engine events. Session update events
  only record the session row they carry; they do not fetch the full transcript
  or graph. Session preview reads are bounded Runtime API calls for index views.
- **Models come from Runtime.** `/models` exposes executable model inventory.
  Runtime owns the provider catalog, enabled providers, provider access,
  provider-specific catalog policy, curated rows, live enrichment, and cache
  behavior. Agent model selection uses narrow agent mutations that update
  Runtime-owned per-agent execution settings, not an app-maintained list.
- **Chat stays canonical.** Runtime chat control routes do not replace the
  durable Chat API timeline.
- **Session facts stay execution-owned.** Session messages, graphs, prompts, and
  resync are runtime evidence for an agent execution.
- **The app is a client.** Tavern App may proxy, cache, and present this data,
  but the cross-boundary contract lives in `@tavern/api`.
