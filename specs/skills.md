# Skills and tools

Skills are reusable instruction packages. Tools are executable agent actions.
MCP connections expose external tools. Channels are chat frontends.

## Product expectations

- A skill has a stable Runtime source identity and may include scripts,
  references, or assets.
- Skill assignment affects instruction access only. It does not grant tools.
- A tool has a stable Runtime identity.
- Host tools and MCP tools are granted independently per agent.
- MCP discovery never grants access. A grant identifies one connection and one
  exact upstream tool name.
- Channels are not MCP connections. They are places where humans talk with
  Tavern agents.

## Ownership

- Runtime is canonical for installed skills, skill assignments, MCP
  connections, connection credentials, host-tool grants, and MCP tool grants.
- Skill packages remain owned by their source location. Tavern shows the
  Runtime inventory without copying packages into an app-owned store.
- External service logic and tool schemas belong to the MCP server.
- Runtime owns AI SDK tool composition, call-time grant checks, MCP client
  lifecycle, sandboxing, durable turns, and metadata-only tool-call audit.
- Credentials stay in the Runtime vault and are never included in prompts,
  tool arguments, or audit rows.

## Sources

### Skills

Runtime reports installed skill packages from managed and external locations.
The App shows Installed and Available views. Globally disabling a skill removes
its current agent assignments after user confirmation; enabling it later does
not restore them.

### Host tools

Browser and `web_fetch` are Tavern host tools. Both use explicit per-agent
grants. New agents receive `web_fetch` by default; Browser remains ungranted
until selected.

Harness-native tools such as shell and file editing come from the selected
executor and remain governed by sandbox and approval policy.

### MCP tools

Settings -> Connections manages HTTP and stdio MCP connections. A connection
represents one server account. Built-in presets reduce configuration but use
the same storage, auth, discovery, and grant path as custom connections.

Runtime discovers upstream tools and presents only granted tools to each agent
with stable namespaced model-visible names. A newly discovered upstream tool
starts ungranted. Runtime rechecks the grant immediately before forwarding a
call.

OAuth connections use Connect/Reconnect and Disconnect. There is no connection
enable switch. Disconnect clears credentials and grants. Custom connections may
also be deleted.

### Channels

Settings -> Channels manages frontend bindings for Tavern agents. Tavern chat
is built in. Discord and other frontends have their own bindings and session
routing.

## UI model

- Settings -> Skills manages global skill inventory and enablement.
- Settings -> Connections manages MCP connection setup, auth, discovery,
  testing, disconnect, and custom-connection deletion.
- Settings -> Browser manages the local Browser host service.
- An agent's Tools tab manages host-tool and exact MCP tool grants.
- Skills remain assigned separately from tools.
- Runtime tool inventory may remain available as diagnostics; it is not the
  source of per-agent grants.

## Failure behavior

- Cached skill and connection records remain visible when Runtime is
  temporarily unavailable.
- Missing dependencies do not silently remove a skill.
- An unavailable granted MCP tool stays visible to the agent and returns the
  connection failure so the agent can report it.
- A failed MCP test does not remove the connection or change grants.
