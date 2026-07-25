---
summary: Normative product contract for MCP connections, credentials, discovery, and exact agent tool grants.
read_when:
  - changing Connections settings or agent Tools
  - changing MCP storage, auth, client lifecycle, or audit
---

# MCP connections

## Product model

- A connection identifies one MCP server account.
- WS6 preserves the existing MCP connection surface: no-auth, secret-header,
  OAuth, and stdio connections plus the Google Calendar and MerchBase presets.
- Built-in presets populate URL and auth defaults. They use the same storage,
  discovery, OAuth, and grant path as custom connections.
- Preset coordinates are Runtime-owned and immutable. Generic connection
  creation cannot select a preset.
- Multiple connections may share a server or preset.
- Connection state is Connect/Reconnect or Disconnect. There is no enabled flag.
- Disconnect clears credentials and exact tool grants. Custom connections may
  also be deleted.

## Agent access

- Grants are `(agent_id, connection_id, upstream_tool_name)`.
- The Agent and connection must belong to the same Computer. Server validation
  rejects cross-Computer grants; tool calls never relay through another
  Computer.
- Grant changes are Server-owned desired state and may be saved while that
  Computer is offline using its last reported connection/tool inventory. They
  remain pending until the Computer reconnects and reports the applied state.
- Tool discovery never grants access.
- A granted tool is presented as an AI SDK tool with a stable namespaced model
  name.
- Runtime rechecks the grant immediately before the upstream call.
- Discovery or session failures stay visible as an unavailable granted tool so
  the agent can report the connection problem.

## Auth

- Secrets stay in the Server attachment's local Runtime vault namespace.
- HTTP connections support no auth, headers, or MCP OAuth.
- OAuth uses protected-resource and authorization-server metadata, PKCE,
  refresh tokens, and DCR through AI SDK. Custom connections may instead
  provide a pre-registered client id, optional client secret, and scopes.
- Computer retains the PKCE verifier. The hosted callback validates
  short-lived routing state and immediately forwards the one-time authorization
  code over the target attachment's live socket. It cannot redeem or persist
  the code. An offline Computer expires the attempt.
- A different authorization-server origin requires persisted user approval.
- Credential-bearing HTTP connections and authorization servers require HTTPS.
  Plain HTTP is allowed only for explicit loopback development.
- Google Calendar uses the packaged Google client because Google does not offer
  DCR. MerchBase uses Clerk DCR.
- Human-entered header values, stdio environment values, and pre-registered
  OAuth client secrets use an online-only typed Server-to-Computer relay. The
  Server never persists, queues, retries, or logs them; an offline Computer
  rejects the mutation.
- Connect, reconnect, test, identity changes, and secret changes require an
  online Computer. They are not queued as desired state.
- Changing URL, command, args, auth, or OAuth client configuration is an
  identity change. Runtime validates the complete new identity, closes its
  existing client, then atomically clears credentials and grants before use.

## Operations

- Tool calls record agent, turn, connection, tool, timestamps, outcome, and
  error summary only.
- HTTP client sessions are isolated by agent and connection.
- Tool listing follows bounded MCP pagination and rejects cursor cycles.
- Expired sessions are closed, evicted, and retried once with a new client.
