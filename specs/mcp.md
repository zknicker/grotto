---
summary: Normative product contract for Server-owned remote MCP connections, credentials, discovery, and Agent access.
read_when:
  - changing Connections settings or Agent Tools
  - changing MCP storage, auth, client lifecycle, or invocation
---

# MCP connections

## Product model

- A connection identifies one remote HTTP MCP server account on one Grotto Server.
- Grotto Server owns its endpoint, credentials, OAuth state, discovered tools, client sessions,
  and invocation.
- Connections support no auth, secret headers, or MCP OAuth. Remote endpoints require HTTPS;
  loopback HTTP exists only for development.
- Grotto does not support local or stdio MCP connections.
- Google Calendar and MerchBase presets populate immutable URL and auth defaults, then use the
  same storage, discovery, OAuth, grant, and invocation path as custom connections.
- Multiple connections may target the same MCP server or preset.
- Disconnect clears the active identity, tokens, inventory, and Agent grants. It preserves
  reusable client registration and operator-approved authorization origins. Custom connections
  may also be deleted.

## Agent access

- A grant is `(server_id, agent_id, connection_id)` and enables every tool currently exposed by
  that connection.
- Tool discovery changes the read-only tool list; it does not create a second grant layer.
- Server rechecks the connection grant before every upstream call.
- Computer receives only safe names, descriptions, and input schemas for granted tools.
- Computer sends invocation through its scoped per-run Server credential. MCP credentials and
  upstream sessions never enter Computer, Agent prompts, or tool arguments.
- An unavailable MCP connection does not prevent an Agent from starting. Its tools are omitted
  until Server can rediscover the connection.
- Server discovers granted connections concurrently with a five-second deadline per connection.
  One slow or unavailable connection cannot hide healthy connections or hold Agent startup open.
- Server resolves invocation authority from the current grant and cached inventory before making
  one upstream call with a 30-second deadline.
- Runner errors preserve whether access was denied or revoked, the upstream account needs
  reauthorization, the upstream timed out, or the upstream is unavailable.

## OAuth and secrets

- PostgreSQL stores MCP secrets in a Server-only table that is never returned by tRPC.
- OAuth uses protected-resource and authorization-server metadata, PKCE, refresh tokens, and DCR
  through AI SDK. Custom connections may use pre-registered client credentials and scopes.
- Server creates and retains PKCE state, handles the hosted callback, exchanges the code, refreshes
  tokens, and persists authorization-server trust.
- A different authorization-server origin requires explicit operator confirmation.
- Google Calendar uses configured Server environment credentials because Google does not offer
  DCR. MerchBase uses Clerk DCR.
- Public reads expose header names, never values.

## Operations

- MCP uses bounded pagination, rejects cursor cycles, and caps discovery at 1,000 tools.
- Clients are pooled by connection and closed on identity, credential, disconnect, or Server
  lifecycle changes.
- Invocation is authorized by the scoped runner identity plus the current Server grant.
- `connected` means the Server retains an active connection identity; it is not transient upstream
  health. Request failures do not disconnect an account or erase grants.
