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

The Server mirrors these routes through the `mcp` tRPC router and owns the
ephemeral loopback callback listener used by the desktop app.
