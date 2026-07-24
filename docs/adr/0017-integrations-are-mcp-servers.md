---
summary: Decision to replace first-party plugins with standard MCP connections, exact per-agent tool grants, and Runtime-owned credentials.
read_when:
  - changing MCP connections, OAuth, tool discovery, or per-agent grants
  - deciding whether a capability is an MCP connection, host tool, skill, or model capability
  - adding an external service integration
---

# ADR 0017: Integrations Are MCP Servers

## Status

Accepted 2026-07-24. Supersedes ADR 0004.

## Decision

External service integrations are standard MCP servers. The plugin product and
implementation model is retired.

Tavern Runtime is an AI SDK MCP client and credential broker:

- Runtime stores connection configuration and secrets locally.
- Runtime discovers tools from the upstream MCP server.
- Agents receive only tools explicitly granted by connection id and upstream
  tool name. New upstream tools are ungranted.
- Runtime rechecks the grant at call time and records metadata-only audit rows.
- Credentials never enter agent prompts, tool arguments, or audit records.
- Runtime does not expose an agent-facing token relay and does not pass Tavern
  tokens upstream.

Each connection is one account. The same MCP server or built-in preset may have
multiple connections. Disconnect removes credentials and all grants for that
connection. Deleting is the same operation plus removal of a custom connection;
the two seeded preset rows cannot be deleted.

OAuth follows the MCP authorization standard through AI SDK. Runtime owns
discovery, PKCE, dynamic client registration, optional pre-registered clients,
refresh tokens, and authorization server trust. The App Server supplies an
ephemeral loopback callback. A cross-origin authorization server requires an
explicit user confirmation that is persisted for that connection.
Credential-bearing remote endpoints require HTTPS. Changing a connection's
URL, command, args, auth, or OAuth client configuration closes the old client
and atomically clears server-bound credentials and grants before the new
identity can be used.

Google Calendar and MerchBase are built-in connection presets only. Runtime
owns their immutable endpoints and auth defaults; generic callers cannot attach
a preset identity to arbitrary coordinates. They reduce configuration; they do
not receive private Grotto protocols or tool code.
Google uses its hosted MCP server and a packaged Google OAuth client. MerchBase
implements a public, standards-compatible MCP server and Clerk DCR so Grotto,
Claude, and other MCP clients use the same boundary.

## Other capability kinds

- Browser and `web_fetch` are host tools with explicit per-agent grants.
  `web_fetch` is granted by default; Browser is not.
- Skills are instruction packages assigned separately from tools. Globally
  disabling a skill removes current agent assignments after confirmation.
- Model-native capabilities remain model configuration, not MCP connections.

There is no global MCP enable/disable state. OAuth connections use
Connect/Reconnect and Disconnect. Custom connections may also be deleted.

## Consequences

- External service logic and schemas live with the MCP server.
- Tavern can connect to any compatible HTTP or stdio MCP server without
  service-specific Runtime code.
- Tool schemas consume context only for agents with exact grants.
- OAuth interoperability is constrained by upstream standards support. Google
  requires its packaged client; Clerk-backed servers use DCR; custom
  connections can supply pre-registered client credentials when DCR is absent.
- ADR 0004 remains historical only.
