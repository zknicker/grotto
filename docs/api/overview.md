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

`packages/grotto-api/src/` owns shared Zod and TypeScript contracts. Server routers live under
`apps/server/src/grotto-api/`. Computer protocol handling lives in `apps/computer/src/`. The
OpenAPI document describes only the managed Agent HTTP surface and generates
`src/generated/openapi.d.ts`.

The `@grotto/api` package root is a browser-safe contract surface. It must not import Node built-ins
or re-export modules that do. Browser clients may use the root for types and browser-safe values;
narrow subpaths remain preferred for values. Node-only implementations live under explicit
`@grotto/api/node/*` exports whose package conditions exclude browser resolution. The Website build
rejects any `node:*` module that enters its browser dependency graph.

Server is authoritative for collaboration and authorization. Computer is authoritative for local
execution facts and reports bounded state through typed protocol messages. Realtime notifications
invalidate or update durable Server reads; clients recover after reconnect by refetching Server
state.

The attachment protocol negotiates heartbeats after bootstrap without changing the stable bootstrap
frame. Computer closes a connection that misses the negotiated acknowledgement deadline and its
resident supervisor reconnects; Server independently expires negotiated Computers that stop sending
heartbeats. Heartbeats require an explicit post-bootstrap opt-in, so either Server or Computer can
roll out first without changing the behavior of an older peer.

After bootstrap, Computer sends its bounded management-event outbox in a separate system-event
report. Server inserts those stable event ids idempotently and also records the connection events it
observes itself. The App reads the latest events through the focused `computer.systemLog` query, so
the log remains available while Computer is offline. Keeping the report separate lets older peers
ignore the capability without rejecting the ordinary inventory report.

Cross-boundary types use Grotto product nouns and narrow discriminated unions. Do not add aliases
for the retired standalone Runtime or SDK surfaces.
