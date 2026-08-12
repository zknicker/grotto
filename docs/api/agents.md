---
summary: Server Agent contracts, Computer execution reports, and managed Agent API routing.
read_when:
  - changing Agent CRUD, execution configuration, Computer reports, or managed Agent routes
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

Managed Agent commands use `/api/agent/*`. The injected `grotto` wrapper calls a per-launch
Computer loopback proxy. Computer serves eligible inbox reads locally or forwards the request with
the scoped runner credential. The Agent process never receives a Server-valid credential.

Wire schemas live in `packages/tavern-api`; Server handlers live in `apps/server/src/agent-api/`
and `apps/server/src/grotto-api/agent/`; Computer proxy and launch behavior live in
`apps/computer/src/`.

Hosted Agent execution detail is a separate, explicit `agent.executionJournal` query. It accepts
one `serverId`, `agentId`, and `runId`; Server authorizes only Owners/Admins, resolves the Agent's
assigned Computer, and relays the request over that authenticated attachment. The response is
either the Computer-local journal or an explicit `unavailable` result (`offline`, `missing`, or
`timeout`). Server does not persist the journal, and ordinary members never receive it.
