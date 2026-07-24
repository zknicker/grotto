---
summary: TypeScript SDK guide for @tavern/api contracts, @tavern/sdk client shape, bot/webhook/local tool usage, capabilities, and compatibility rules.
read_when:
  - changing @tavern/api, @tavern/sdk, or client examples
  - adding bots, webhooks, automations, local tools, or MCP connections
---

# TypeScript SDK

The TypeScript SDK is how TypeScript code talks to the Tavern API.

Tavern App uses it. Bots use it. Webhooks use it. Local tools use it.
Tests use it. The SDK does not care whether the current implementation passes
through React, tRPC, SQLite, or local Node code.

The package split is deliberate:

* **`@tavern/api`.** Tavern API contracts, including OpenAPI-generated chat and
  realtime types plus typed admin schemas.
* **`@tavern/sdk`.** Fetch and WebSocket client wrapper.
* **Tavern Runtime.** Durable chat server that implements the contract.
* **Tavern App.** First-party client and presentation layer.

## Shape

Think of the app boundary like this:

```text
Tavern App, bot, webhook, runtime, or local tool
  -> TypeScript SDK
  -> Tavern API
  -> Tavern Runtime
```

For agent execution:

```text
AI SDK executor -> Tavern Runtime stores -> Tavern API reads
```

## Packages

Use package names to keep the boundary clear:

* `@tavern/api` exports OpenAPI-generated schemas, ids, events, admin schemas,
  and contract types.
* `@tavern/sdk` wraps those contracts in a TypeScript client.

The SDK is the client. The API package is the contract source. Chat and
realtime changes start in OpenAPI; admin changes start in the typed runtime
contracts.

Package shape:

```text
packages/tavern-api/
  openapi.yaml
  src/
    generated/
      openapi.d.ts
    index.ts

packages/tavern-sdk/
  src/
    client.ts
```

Ownership:

* `@tavern/api`: client-facing contracts
* `@tavern/sdk`: TypeScript client wrapper
* runtime code: model-provider mapping, turn execution, and event projection
* runtime code: canonical chat storage, events, automation delivery
* app code: cache, presentation, hooks, UI

## Capabilities

| Capability | Doc |
| --- | --- |
| App and runtime API surfaces | [API Overview](api/overview.md) |
| Realtime subscriptions and recovery | [Realtime](api/realtime.md) |
| Chat messages, responses, activity, artifacts, and delivery | [Chat API](api/chat.md) |
| Health, status, and admin control | [Admin API](api/admin.md) |
| Agents, models, skills, and tool grants | [Agents API](api/agents.md) |
| Memory inspection and review | [Memory API](api/memory.md) |
| Wiki pages and citations | [Memory API](api/memory.md) |
| Cron automations and run history | [Automations API](api/automations.md) |
| Skill packages and assignment | [Skills API](api/skills.md) |
| MCP connections and exact tool grants | [Connections API](api/connections.md) |
| Usage and operational stats | [Stats API](api/stats.md) |

## Rules

* **Contract first.** Change `@tavern/api` contracts before changing SDK
  methods or runtime handlers.
* **Durable first.** Create messages before work starts.
* **Receipts reconcile.** Return the existing receipt for duplicate ids or
  nonces.
* **History orders.** Order chat history by per-chat sequence.
* **Events notify.** Recover reloads and missed websockets from durable reads.
* **Activity is durable.** Store response work in activity rows, not transcript
  rows.
* **Tavern nouns lead.** Keep runtime words in metadata.
