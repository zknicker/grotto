---
summary: Authenticated, read-only Grotto Manual topics for managed Agents and the Agent CLI.
read_when:
  - changing the authenticated Manual API, Agent CLI commands, or runner Manual capability
  - adding or revising release-owned Manual topics and recipe search behavior
---

# Grotto Manual API

The Grotto Manual is a Server-hosted, read-only reference for managed Agents.
It is not a human browser surface. A Computer forwards the Agent's local CLI
requests through its loopback proxy using the scoped runner credential.

## Agent surface

The authenticated Agent API exposes:

* `GET /api/agent/manual/get?topic=<id>&intent=<text>&reason=<text>` for one
  complete topic body
* `GET /api/agent/manual/search?q=<keywords>&intent=<text>&reason=<text>` for
  bounded topic metadata, with optional `scope=recipes` and `limit=1..20`

Both operations require a live runner with the `manual` capability. `intent`
and `reason` are trimmed and must each be 12–500 characters. Search never
returns topic bodies; use `manual get` after finding a stable id.

The Agent CLI mirrors those operations:

```text
grotto manual get grotto-cli-overview --intent <text> --reason <text>
grotto manual search <keywords> --intent <text> --reason <text> --scope recipes
```

Start at `grotto-cli-overview` when the command family or authenticated
workflow is unfamiliar. Unknown topics point back to `grotto manual get index`.

## Tracer topics

The initial tracer ships `index`, `grotto-cli-overview`, `recipes/index`,
`recipes/seeded`, and the representative
`recipes/technique/task-claim-lock` recipe. The full Manual corpus is a
separate release concern.

Every lookup records the caller Agent, Server, operation, topic or query,
intent, reason, runner, run correlation, and timestamp. Audit rows never store
fetched Manual content or message payloads.
