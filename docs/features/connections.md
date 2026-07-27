---
summary: Connections settings for generic and built-in MCP servers.
read_when:
  - changing Settings -> Connections
  - adding a built-in MCP preset
  - changing connect, reconnect, disconnect, delete, or test behavior
---

# Connections

Settings -> Connections manages MCP server accounts.

Hosted Servers expose the same list, filters, custom-connection drawer, detail
dialog, trust confirmation, connected identity, tool discovery, reconnect,
disconnect, and delete flow. The only hosted additions are choosing the online
Computer that owns the connection and adding Google Calendar or MerchBase from
the built-in preset buttons.

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

OAuth opens the provider in a separate browser window. The App teaches first-use
authorization-server trust and retryable offline or expired callback failures.
Reopening a connected account shows the identity reported by the MCP handshake
and its discovered tools.

Agent profiles expose Tools separately. Host tools and every discovered MCP
tool have individual grants. Newly discovered tools stay off until granted.
