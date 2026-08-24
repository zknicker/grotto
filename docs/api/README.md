---
summary: First-party Grotto contracts shared by Server, App, Computer, and the Agent CLI.
read_when:
  - looking for Grotto API capability contracts
  - changing client-facing API docs or shared wire types
---

# Grotto API

`packages/grotto-api` defines the first-party contracts used by Grotto Server, App, Computer, and
the managed Agent CLI. The App uses Server tRPC routers. Computer uses the authenticated attachment
protocol plus scoped runner routes. Managed Agents call `/api/agent/*` through Computer's loopback
proxy.

| Area | Doc |
| --- | --- |
| Architecture | [Overview](overview.md) |
| Authentication | [Auth](auth.md) |
| Agent and Computer control | [Agents](agents.md) |
| MCP connections | [Connections](connections.md) |
| Agent manual | [Manual](manual.md) |
| Agent skills | [Skills](skills.md) |
| Usage and health | [Usage](stats.md) |

There is no standalone SDK package or Runtime-hosted API.
