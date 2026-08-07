---
summary: Grotto API map for the @tavern/api contract, Runtime host, SDK wrapper, and capability docs.
read_when:
  - looking for Grotto API capability contracts
  - changing client-facing API docs
---

# Grotto API

The Grotto API is `@tavern/api`-defined, Runtime-hosted, and SDK-wrapped.

Grotto App, bots, webhooks, automations, local tools, and tests use this
surface instead of reading app caches, runtime tables, or executor state.

Grotto's shape is clear:

* **`@tavern/api` defines the contract.** OpenAPI owns chat and realtime wire
  shapes; typed runtime contracts own admin and control routes.
* **Runtime serves the contract.** Grotto Runtime owns durable chat state,
  responses, activity, artifacts, event cursors, and automation delivery.
* **The SDK wraps the contract.** `@tavern/sdk` gives TypeScript clients a small
  typed API over Grotto API types.
* **Docs explain behavior.** Markdown covers ownership, ordering, durability,
  recovery, and intentional omissions.

| Area | Doc |
| --- | --- |
| Overview | [API Overview](overview.md) |
| Auth | [Auth](auth.md) |
| Realtime | [Realtime](realtime.md) |
| Chat | [Chat API](chat.md) |
| Admin | [Admin API](admin.md) |
| Agents | [Agents API](agents.md) |
| Skills | [Skills API](skills.md) |
| Stats | [Stats API](stats.md) |
| Connections | [Connections API](connections.md) |

The TypeScript client wrapper lives in [TypeScript SDK](../sdk.md).
