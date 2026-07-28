---
summary: Server settings for remote MCP accounts and connection-level Agent access.
read_when:
  - changing Settings -> Connections
  - adding an MCP preset
  - changing connect, reconnect, disconnect, or Agent access behavior
---

# Connections

Server Settings -> Connections manages remote MCP server accounts.

The page follows Raft's flow: list MCP servers, add a remote endpoint, choose no auth, headers, or
OAuth, complete authentication in a browser window, and inspect the connected identity and
discovered tools. There is no Computer picker and no local or stdio transport.

Google Calendar and MerchBase are presets for endpoint and auth defaults. They remain ordinary MCP
connections, and another account can be added from the connection detail.

Disconnect warns which Agents lose access, then clears active credentials, discovered tools, and
grants. Custom connections may be deleted. Reconnect uses the same connection and can reuse its
configured OAuth client and previously approved authorization-server origins.

Each Agent profile shows one switch per connected MCP server. Turning it on grants that Agent all
tools exposed by the connection. The tool names are read-only context, not individual permission
controls.
