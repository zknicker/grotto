---
summary: Connections settings for generic and built-in MCP servers.
read_when:
  - changing Settings -> Connections
  - adding a built-in MCP preset
  - changing connect, reconnect, disconnect, delete, or test behavior
---

# Connections

Settings -> Connections manages MCP server accounts.

Google Calendar and MerchBase ship as presets to avoid manual URL and auth
configuration. They remain ordinary MCP connections. Users may connect another
account for the same preset or add a custom HTTP or stdio server.

The overview filters connections by status. Selecting a connection opens its
server identity, authenticated status, discovered tools, and affected agents.
OAuth connections offer Connect or Reconnect. The actions menu refreshes tools,
adds another preset account, disconnects an account, or deletes a custom
connection.

Disconnect warns which agents lose tools, then clears credentials and grants.
Custom OAuth defaults to dynamic client registration and also accepts optional
pre-registered client credentials and scopes.

Agent profiles expose Tools separately. Host tools and every discovered MCP
tool have individual grants. Newly discovered tools stay off until granted.
