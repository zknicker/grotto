---
summary: Tavern Runtime's agent-engine contract for chats, Agent sessions, AI SDK HarnessAgent execution, model provider setup, executable model inventory, tools, and deterministic tests.
read_when:
  - changing Tavern Runtime agent execution
  - changing AI SDK HarnessAgent execution
  - changing agent instructions, runtime skills, tools, inbox delivery, or turn evidence
  - changing model provider setup, model defaults, or Agent session model selection
  - changing deterministic e2e executor behavior
---

# Agent Engine Runtime

Tavern Runtime is the agent engine boundary. It owns canonical chats, chat
participants, Agent seats, Agent sessions, Agent turns, model provider setup,
executable model inventory, Runtime profiles, instruction composition, tool
exposure, inbox delivery, and turn routing.

Tavern App and Tavern Server are clients. They may proxy Runtime data and shape
it for the UI, but they must not own executable agent state. A direct Runtime
API client should be able to list executable models, update an Agent default
model, send a chat message, inspect activity, start a new Agent session, and
stop a turn without the Tavern App process.

Runtime does not depend on Vercel managed infrastructure for local execution.

See [ADR 0007](../adr/0007-chat-participants-own-agent-sessions.md) for the
chat participant and Agent session decision.

## Agent Seats And Sessions

An Agent's participation in a Chat is an Agent seat: an agent participant row
inside that Chat. Seats route messages; the agent itself owns exactly one
current global Agent session.

```text
ChatParticipant
  chatId
  participantId
  agentId

AgentSession
  id
  agentId
  effectiveModel
  runtimeSessionId
  resumeState
  generation
  status
  lastTurnAt
```

The Agent seat is stable Tavern product state. The Agent session is
agent-global (ADR 0011, `specs/sessions.md`): one ongoing session per agent
backs every chat that agent sits in. Turns float on the session rather than
anchoring to a chat (ADR 0014); a two-cursor inbox ledger per (session,
target) tracks what has been delivered and what is provably model-visible
(`specs/inbox.md`). A fresh session starts only on a model switch, a manual
reset from agent settings, or after ~7 fully idle days; starting one archives
the previous active session.

A channel with multiple agents is not one engine session. Each agent runs
its own global session. A durable message never invokes an agent directly —
Runtime's delivery planner queues it per attention rules, and an idle
agent's next drain turn (or a busy agent's content-free notice) is how it
reaches execution (`specs/inbox.md`).

## Execution

Runtime executes every Agent turn through AI SDK `HarnessAgent`. The catalog
record's `executionKind` is always `harness`; it remains in the API as an
explicit execution fact for headless clients.

| Execution kind | Providers | Implementation |
| --- | --- | --- |
| `harness` | Claude Code, Codex, OpenAI, OpenAI-compatible | AI SDK `HarnessAgent` with local trusted sandbox mode `none`. |

Provider adapters are internal implementation choices:

- `@ai-sdk/harness-claude-code`
- `@ai-sdk/harness-codex`
- `@ai-sdk/harness-pi` for OpenAI and OpenAI-compatible API-key routes

The harness executor creates a session and sends the prompt. The agent's
final reply is not derived from the model's text output — the model speaks
only by running `grotto message send` from inside the turn (ADR 0014); text
emitted outside a `grotto` command is delivered to no one. After the turn
settles, Runtime stores the opaque harness resume state on the Agent session
and stops the session handle.

A fresh session's first turn is a bare `Start.` turn. After that, an idle
agent's next turn is a drain: it batches every pending inbox target — every
row between that target's `seen` and `delivered` cursor, plus any pierce rows
— as labeled envelopes closed by a verbatim trailer telling the agent to
respond as appropriate (`specs/inbox.md`). The prompt does not replay the
prior user-agent transcript, because the harness session owns that history;
it carries only the batch of envelopes plus a chain-budget note when the
drain is all agent-authored.
Each turn prompt is time-anchored with the current time, and every included
message carries its send time — weekday-prefixed home-timezone wall clock,
e.g. `Sun 2026-07-05T13:22:42-04:00` (`apps/runtime/src/tavern/harness-prompt.ts`,
timezone from `resolveHomeTimezone()`). Static per-session guidance — the home
timezone, the staleness policy, and Tavern CLI guidance — lives in the
composed agent instructions, not the per-turn prompt, so long sessions carry
one copy instead of one per turn.
The composed instructions are agent-global — no chat-specific content — and
append model-family operational guidance (`apps/runtime/src/tavern/model-instructions.ts`): tool-use
enforcement and execution discipline for gpt/codex-class models, Google
directives for gemini/gemma, nothing for Claude models.
When a drain's envelopes are shown, Runtime advances each embedded target's
`seen` cursor to the sequence shown at turn settle.
Each turn also records prompt evidence — the composed instructions and the
per-turn prompt — in `agent_turns` metadata at turn start, served on demand
at `GET /api/turns/{run_id}/prompt`. Dev mode (desktop Developer menu) adds
the raw prompt blob.
Turns also record workspace file-change evidence: a bounded snapshot brackets
the turn, and the compared pair settles as `agent_turn_file_changes` rows plus
a `workspace_changes` tool activity, served at
`GET /api/turns/{run_id}/file-changes` (see
[data model](data-model.md#agent_turn_file_changes)).

Tool calls are auto-approved. Tavern does not expose an interactive tool
approval prompt. Harness-native tools come from the selected executor. Runtime
adds only host tools and exact upstream MCP tools granted to the agent, and
rechecks MCP grants immediately before each call. Safety is controlled through
sandbox mode plus any Runtime approval policy. The current sandbox mode is
`none`: a trusted local workspace rooted at
`.tavern/agents/<agent-id>/workspace`. It scopes working directory and files; it
is not a security sandbox.

Harnesses may need local OAuth credentials to call their native CLIs. Runtime
seeds only the required credential files into the workspace-local process home.
It must not inherit arbitrary host configuration files such as Codex
`config.toml`, because host CLI versions and bundled harness SDK versions can
parse different config vocabularies.

Claude Code harness turns receive their credential from the Runtime: a
vault-stored Claude sign-in (`authToken`, refreshed before the turn) for the
`claude` provider, or the vault Anthropic API key (`apiKey`) for the
`anthropic` provider. When the `claude` provider has no stored sign-in, the
harness falls back to its own discovery of a detected host Claude Code login —
reliable on desktop Macs, not on headless hosts (see
[specs/model-access.md](../../specs/model-access.md)).
`TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN` (`claude setup-token`) remains an
operator env escape hatch and loses to stored credentials.

Executor failures settle the Agent turn and linked response as failed Tavern
state. They must not crash the Runtime process.
Agent turns also have a Runtime watchdog (`TAVERN_AGENT_TURN_TIMEOUT_MS`,
default 5 minutes) so a hung provider settles as failed instead of keeping the
chat active forever. Dispatched task turns get a longer watchdog
(`TAVERN_TASK_TURN_TIMEOUT_MS`, default 30 minutes) because tracked work
legitimately runs long; a timeout there counts as a failed dispatch attempt.

## Model Providers And Inventory

Runtime owns model provider setup, executable model inventory, and agent model selection.

`apps/runtime/src/models/catalog-service.ts` is the single Runtime model
inventory entrypoint. Provider registry, access state, model count, warnings,
availability, and sorted executable model rows are assembled there.

Curated model lists live in `apps/runtime/src/models/curated/`. Provider
behavior lives in `apps/runtime/src/models/provider-sources/`.

- Claude Code and Codex use curated HarnessAgent model lists.
- Missing local OAuth CLI setup marks enabled provider access as not ready; it does not make the
  provider disappear from Settings.
- OpenAI uses the Pi harness API-key route. It keeps a curated allowlist and may
  enrich executable rows with cached live discovery from the OpenAI models endpoint.

Model records include Runtime execution facts needed by headless clients:
stable `id`, display `label`, `provider`, `route`, `executionKind`,
`availability`, `sourceKind`, and auth/source metadata. Tavern App may choose
icons, colors, and layout. It must not reconstruct model routes or provider
availability from display strings.

The provider catalog is separate from executable inventory. The provider
catalog lists addable providers; Runtime-enabled providers store the user's
provider choices; executable model inventory contains only model records whose
provider access is ready for Agent turns.

## Model Selection

Agent runtime profiles store the Agent default model for new sessions in
`agent_runtime_profiles.default_model_json`. Agent rows do not own model
choices.

When an Agent has no saved model profile, Runtime sets the Agent default to the
highest-ranked executable model. If no executable model exists, Runtime leaves
the Agent without an executable default and surfaces provider setup instead of
falling back to a non-executable provider.

When a saved default model is invalid or unavailable, Runtime Doctor repairs the
Agent default to the highest-ranked executable model. If no executable model
exists, Runtime leaves the Agent unresolved and surfaces provider setup.

Each Agent session stores its own `effectiveModel`; that is the model
actually used by the session's turns.

Changing a model in Settings updates the Agent runtime profile default. The
change takes effect lazily: the agent's next turn notices the mismatch,
archives the active session, and starts a fresh session on the new model.
Sessions are never mutated to a different model in place.

## Instructions And Tools

Runtime composes the bootstrapped Agent's instructions from Tavern-owned
managed instruction text and the agent's description (the personality
surface) — there is no separate identity file. Durable per-agent notes are
the agent's own workspace files (`MEMORY.md` and notes/), which it maintains
itself; Runtime does not inject them into the prompt. Skills are assigned
execution resources, not instruction text. The workspace lives under the
Runtime data root:

```text
.tavern/agents/<agent-id>/workspace
```

Skills are loaded as Runtime turn context, not as an App-side convention. At
turn startup, Runtime reads the agent's `enabledSkillIds` and resolves those
ids against installed skill packages. Harness execution passes the resolved
bundles through the AI SDK `HarnessAgent` `skills` setting so adapters can
surface them as runtime skills. Runtime does not inline `SKILL.md` content into
`system`.

Linked skill references in a message use `skill://<skill-id>` and only nudge the
current turn. Runtime intersects those references with the addressed Agent's
`enabledSkillIds` and adds a compact activation hint for matches. A linked skill
that is not assigned to that Agent produces no hidden prompt context and does
not grant access.

Runtime composes the AI SDK tool set for each turn from three sources:

1. harness-native tools supplied by the selected executor,
2. explicitly granted host tools such as Browser and `web_fetch`, and
3. explicitly granted tools discovered from MCP connections.

MCP tools keep their upstream schemas and receive stable namespaced
model-visible names. A Server-owned `(Server, Agent, connection)` grant enables
the connection's current tools. Grotto Server rechecks it immediately before
the upstream call. Computer receives safe schemas and proxies invocation.
Messaging, chat
history, and channel attention remain CLI verbs on PATH rather than MCP tools.

Agents read chat history themselves through `grotto message read` and
`grotto message search` rather than a tool call — same-chat and cross-chat,
bounded to what the CLI resolves.

Web access is a per-agent opt-in (`webAccessEnabled`, default off) for the
executor's provider-native web search where the model supports it. The
Runtime-local `web_fetch` tool (`apps/runtime/src/web/`) is a separate host
tool grant and is granted to new agents by default. It fetches one URL and
returns readable, size-capped markdown. Native page-fetch tools stay disabled
so page reads share one size cap and injection posture.

Runtime writes product facts through Tavern stores. The agent itself writes
`chat_messages` (via `grotto message send`); Runtime writes `agent_turns` and
`agent_turn_file_changes` as the durable execution record.
`chat_responses` / `chat_response_activity` / `chat_deliveries` remain
schema-backed but are not written for real turns (see
[data model](data-model.md)).

Provider-specific traces, model usage, finish reasons, and opaque resume state
remain execution evidence in metadata.

## Testing

Use deterministic fake executors for unit and browser e2e flows. Mock only true
external boundaries: model calls, harness processes, network transport, time,
and randomness.

Harness smoke tests should run against the local Claude Code, Codex, and Pi
provider credentials when validating this worktree manually.
