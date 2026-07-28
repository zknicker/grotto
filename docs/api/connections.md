---
summary: Server tRPC and runner contracts for remote MCP connections and connection-level Agent access.
read_when:
  - changing MCP Server tRPC procedures
  - changing connection, secret, discovery, runner, or grant schemas
---

# Connections API

The App uses the Grotto Server `mcp` tRPC router:

- `mcp.add`
- `mcp.addPresetAccount`
- `mcp.list`
- `mcp.startOAuth`
- `mcp.refresh`
- `mcp.replaceHeaders`
- `mcp.disconnect`
- `mcp.delete`
- `mcp.setGrant`

`mcp.add` accepts one HTTPS remote endpoint plus no auth, secret headers, or MCP OAuth
configuration. Public connection reads expose header names and discovered tool names, never secret
values. Preset creation resolves immutable Server-owned coordinates.

`mcp.startOAuth` creates Server-held PKCE and routing state. The hosted callback validates state;
Server exchanges the code, persists tokens and client registration, and performs refresh. Computer
does not participate.

`mcp.setGrant` stores one `(Server, Agent, connection)` grant. Enabling it makes every current tool
on the connection available to that Agent.

During an Agent launch, Computer calls two scoped Server endpoints through its per-run loopback
proxy:

```txt
GET  /api/agent/mcp/tools
POST /api/agent/mcp/invoke
```

The first returns safe tool names, descriptions, and input schemas for currently granted
connections. The second resolves the tool, rechecks the grant, and invokes the upstream MCP from
Server. Computer never receives MCP secrets, OAuth tokens, or upstream session state.
