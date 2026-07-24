---
summary: Tavern API architecture for typed chat/realtime contracts, Runtime admin contracts, SDK wrappers, and contract rules.
read_when:
  - changing tRPC routers, runtime HTTP routes, websocket behavior, or SDK methods
  - adding MCP connections, bots, webhooks, automations, or external clients
---

# API Overview

The Tavern API is the stable contract between Tavern App, Tavern Server,
Runtime, SDK clients, bots, webhooks, automations, and local tools.

```text
Tavern App, bot, webhook, automation, or local tool
  -> TypeScript SDK or app backend proxy
  -> Tavern API
  -> Tavern Runtime
```

Tavern's shape is:

- **OpenAPI for chat and realtime.** `packages/tavern-api/openapi.yaml` defines
  durable Chat messages, responses, activity, artifacts, receipts, events, and
  errors.
- **Typed Runtime admin contracts.** `packages/tavern-api/src/runtime/*` owns
  health, status, agents, presence, activity, inbox, sessions, skills, models,
  files, and bindings.
- **Runtime handlers.** Tavern Runtime returns Tavern API-shaped payloads.
- **SDK wrapper.** TypeScript clients should import the SDK instead of reading
  app caches or Runtime tables directly.

## Contract Rules

- Product nouns come first: Chat, message, participant, Agent session, Agent
  turn, model, tool, automation.
- Runtime is the source of truth for values that affect execution.
- Provider-specific execution details stay metadata unless the product needs a
  stable cross-provider field.
- App projections may choose labels, colors, icons, and layout, but must not
  reconstruct model routes, provider availability, or session ids.
- Do not add compatibility aliases for retired names in new contracts.

## Source Map

| Surface | Path | Owns |
| --- | --- | --- |
| OpenAPI contract | `packages/tavern-api/openapi.yaml` | Chat and realtime wire objects |
| Generated API types | `packages/tavern-api/src/generated/openapi.d.ts` | Types generated from OpenAPI |
| Runtime routes | `packages/tavern-api/src/runtime/routes.ts` | Runtime control route names |
| Runtime schemas | `packages/tavern-api/src/runtime/contracts.ts` | Runtime-owned request and response schemas |
| TypeScript SDK | `packages/tavern-sdk` | Client wrapper for App, bots, webhooks, automations, and tests |
| Server app routers | `apps/server/src/api/` | First-party app wrapper/proxy for Tavern API |
| Runtime handlers | `apps/runtime/src/` | Runtime-owned storage, execution, and projections |

Implementation files can move. API contracts stay organized around Tavern
capabilities.

## Realtime

Realtime events recover through durable Chat state. Browser streams are not the
source of truth. If a client reconnects, it refetches durable Chat data and
subscribes to active Runtime turn events.

## Related Docs

- [Chat API](chat.md)
- [Realtime](realtime.md)
- [Agents API](agents.md)
- [Skills API](skills.md)
- [Connections API](connections.md)
- [Agent Engine Runtime](../internals/agent-engine-runtime.md)
- [Architecture Overview](../internals/architecture-overview.md)
