---
summary: Runtime and Server contracts for MCP connections, OAuth, discovery, and agent tool grants.
read_when:
  - changing MCP Runtime routes or Server tRPC procedures
  - changing connection or grant schemas
---

# Connections API

Runtime owns:

```txt
GET    /mcp/connections
POST   /mcp/connections
POST   /mcp/preset-accounts
PATCH  /mcp/connections/{id}
DELETE /mcp/connections/{id}
POST   /mcp/connections/{id}/disconnect
POST   /mcp/connections/{id}/test
GET    /mcp/connections/{id}/tools
POST   /mcp/connections/{id}/oauth/start
POST   /mcp/connections/{id}/oauth/complete
GET    /mcp/agents/{agentId}/grants
PUT    /mcp/agents/{agentId}/connections/{connectionId}/tools/{toolName}/grant
GET    /mcp/agents/{agentId}/host-tools
PUT    /mcp/agents/{agentId}/host-tools/{toolId}/grant
```

Public connection reads expose header names, never values. OAuth tokens, client
registration, configured client secrets, PKCE state, approved
authorization-server origins, stdio env, and header values remain Runtime vault
data. Generic connection creation does not accept preset ids; the preset-account
route resolves the immutable built-in endpoint and auth configuration.

The App uses the same connection shapes through Runtime or the hosted Server
`mcp` tRPC router.

Hosted Server connections use the same product contract through the attached
Computer:

- `mcp.add` requires the selected Computer online. The Server forwards headers
  and stdio environment exactly once over that live attachment and stores only
  endpoint identity, header names, and discovered tool names.
- `mcp.list` returns Server-owned public connection state. An offline Computer
  reports `pending` with its last tool inventory and connected identity.
- `mcp.startOAuth` creates short-lived routing state. The Server validates that
  state and relays one live callback code to the exact Computer attachment. It
  never stores PKCE, client registration, tokens, or callback codes, and never
  retries a callback. Expired, offline, replayed, or wrong-attachment callbacks
  fail closed.
- The Computer owns OAuth discovery, PKCE, client registration, token refresh,
  connected identity, and its attachment-scoped vault. Google Calendar uses its
  packaged client, MerchBase uses dynamic client registration, and custom OAuth
  supports dynamic or pre-registered clients.
- `mcp.setGrant` stores exact `(Agent, connection, upstream tool)` desired state.
  Agent and connection must belong to the same Computer. Online changes are
  also pushed to that attachment so invocation-time checks see revocations.

The Computer stores public connection configuration separately from its vault
under the Server attachment root, maintains MCP sessions there, and checks the
exact current grant immediately before each upstream call. Another attachment
cannot resolve those connection files, credentials, or sessions.
