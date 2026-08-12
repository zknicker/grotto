---
summary: API ownership across hosted tRPC, Computer attachment protocol, and scoped Agent HTTP routes.
read_when:
  - changing Server routers, Computer protocol, Agent HTTP routes, or shared API types
  - adding a first-party cross-boundary capability
---

# API overview

```text
App -- tRPC --> Server
Computer -- attachment protocol --> Server
Agent CLI -- localhost proxy --> Computer -- scoped HTTP --> Server
```

`packages/tavern-api/src/` owns shared Zod and TypeScript contracts. Server routers live under
`apps/server/src/grotto-api/`. Computer protocol handling lives in `apps/computer/src/`. The
OpenAPI document describes only the managed Agent HTTP surface and generates
`src/generated/openapi.d.ts`.

Server is authoritative for collaboration and authorization. Computer is authoritative for local
execution facts and reports bounded state through typed protocol messages. Realtime notifications
invalidate or update durable Server reads; clients recover after reconnect by refetching Server
state.

Cross-boundary types use Grotto product nouns and narrow discriminated unions. Do not add aliases
for the retired standalone Runtime or SDK surfaces.
