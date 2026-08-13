---
summary: Server Agent contracts, Computer execution reports, turn and delivery observability, and managed Agent API routing.
read_when:
  - changing Agent CRUD, execution configuration, Computer reports, or managed Agent routes
  - reading Agent turn records or the delivery ledger
---

# Agents API

Server owns each Agent's identity, Server membership, Computer assignment, desired execution
configuration, lifecycle state, Chat participation, and bounded turn summaries. Computer owns the
Agent's workspace, skills, queue, session process, execution runtime, model access, and effective
execution state.

The App uses the Server `agent` tRPC router for Agent reads and mutations. Server validates that
runtime and model references came from the assigned Computer's reported inventory. Changes can be
recorded while Computer is offline and are applied after reconnect; Computer reports degraded state
instead of silently substituting another runtime or model.

## Turn And Delivery Observability

Two member-scoped queries expose what an Agent actually did, without reading
Computer-local execution traces. Both require Server membership and both treat a
denied or unknown Agent as `NOT_FOUND`, so probing cannot distinguish "not
yours" from "does not exist".

`agent.turns` returns that Agent's settled turns, newest first by `startedAt`,
with `limit` between 1 and 50 (default 10). Each record carries `runId`,
`startedAt`, `endedAt`, `status` (`completed` or `failed`), `failureKind` (the
compact kind that crosses the Server boundary, otherwise null), `outputProduced`,
`messageCount`, and the bounded `summary`. `outputProduced` is what makes a
silent turn readable: a completed turn with no output and no messages is
positive proof the Agent chose to stay quiet, not evidence of a lost run.

`agent.deliveries` returns that Agent's delivery ledger, newest first by
`createdAt`, with `limit` between 1 and 100 (default 50). Each record carries
`chatId`, `messageId`, `state` (`queued`, `accepted`, `served`, `seen`),
`turnId`, and the per-state timestamps `createdAt`, `acceptedAt`, `servedAt`,
and `seenAt`. Rows are retained after settlement rather than deleted, so
"never delivered" and "delivered and answered with silence" read differently.
`turnId` is the run that consumed the row; it stays null when the seen cursor
subsumed the row instead of a turn settling it.

Managed Agent commands use `/api/agent/*`. The injected `grotto` wrapper calls a per-launch
Computer loopback proxy. Computer serves eligible inbox reads locally or forwards the request with
the scoped runner credential. The Agent process never receives a Server-valid credential.

Wire schemas live in `packages/tavern-api`; Server handlers live in `apps/server/src/agent-api/`
and `apps/server/src/grotto-api/agent/`; Computer proxy and launch behavior live in
`apps/computer/src/`.
