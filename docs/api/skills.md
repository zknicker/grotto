---
summary: Agent-local skill library and host import contracts.
read_when:
  - changing Agent skill API routes or Computer skill reports
---

# Skills API

## Agent API

The scoped Agent API exposes the calling Agent's canonical library:

- `GET /api/agent/skills`
- `GET /api/agent/skills/:skillId`
- `POST /api/agent/skills/create`
- `POST /api/agent/skills/patch`
- `POST /api/agent/skills/write-file`
- `DELETE /api/agent/skills/:skillId`

Every route is bound to the authenticated Agent id. Paths are validated inside
that Agent's skill directory. The API cannot read or mutate another Agent's
library or a host import source.

## Computer report

The Computer's ordinary attachment report includes:

- `importableSkills`: opaque source id, name, description, and shortened source
  location for host-installed bundles.
- `agentSkills`: Agent id plus compact name, description, content hash, and
  modification time for each Agent-local bundle.

Only metadata reaches the Server. The Server stores the latest complete
inventory in `computers.reported_inventory` for offline display.

## Operator import

`agent.importSkill` accepts `serverId`, `agentId`, and a reported `sourceId`.
Only a Server Owner or Admin may call it. The Server verifies that the Agent is
assigned to the reporting Computer, then sends a typed import request over that
Computer's live attachment.

The Computer resolves the opaque source id against a fresh local scan, waits
for any active turn to settle, copies the bundle atomically into the Agent's
library, and returns compact metadata. The Server never receives bundle bytes.
The operation fails if the source disappeared, the Computer is offline, or the
Agent already owns a same-name skill.

The independent copy is visible to the next turn. There is no background sync.
