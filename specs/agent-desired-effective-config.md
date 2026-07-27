---
summary: PRD-144 — creating a hosted Agent on one Computer with Server-owned desired configuration and Computer-reported effective state.
read_when:
  - changing hosted Agent creation, Computer inventory, or desired/effective execution config
  - changing the Agent DM shape or how Agents appear as DM peers
  - changing the Computer attachment socket handshake or effective-state reporting
---

# Agent desired and effective configuration (WS6 / PRD-144)

## Contract

A hosted Agent is created on exactly one attached Computer with an explicit
runtime and model. The Server owns **desired** configuration; the Computer
reports **effective** state. The two are never conflated.

- **Computer inventory** is a sanitized runtime/model catalogue the Computer
  reports over its attachment socket. It carries only runtime and model ids and
  labels — never provider credentials. It is stored as the Computer's
  last-reported inventory and replaced wholesale on each report.
- **Agent creation** requires one reported Computer plus a runtime and model
  that exist in that Computer's last-reported inventory. Creation mints the
  Agent, records its immutable Computer assignment and desired runtime/model,
  and opens the normal Owner↔Agent DM. No special onboarding Channel.
- **Immutable assignment / no substitution.** An Agent's Computer never
  changes. Desired runtime/model are validated only against that same
  Computer's inventory. If a referenced runtime or model is absent, the request
  fails closed; the Server never substitutes another runtime or model.
- **Offline desired edits.** Runtime/model desired state may be saved while the
  Computer is offline, validated against its last-reported inventory. The
  change is pending until the Computer reports a matching effective snapshot.
- **Effective state.** The Computer reports each Agent's effective runtime,
  model, and the list of any missing local resources. The App shows an Agent as:
  - `pending` — no effective snapshot yet, or the latest effective snapshot
    does not match the current desired runtime/model.
  - `applied` — effective runtime/model match desired and the Computer reports
    nothing missing.
  - `degraded` — the Computer reports one or more required local resources
    missing (`missingResources`). The list is shown; nothing is substituted.
- **Cove.** When a Server has no Agents yet and a Computer has reported
  inventory, guided creation offers `Cove` as the default first Agent. It is an
  ordinary Agent in an ordinary DM.
- **Fail closed across Computers.** Configuration may only reference inventory
  reported by the Agent's own Computer. Referencing another Server's Computer,
  another Computer's runtime/model, or an unreported runtime/model is rejected
  in contract and end-to-end tests.

## Storage

- `computers.reported_inventory` (jsonb) — the last-reported sanitized
  runtime/model catalogue, replaced wholesale on each report.
- `agents.computer_id` (immutable, FK to the same Server's Computer),
  `agents.desired_runtime_id`, `agents.desired_model_id`, and the effective
  snapshot `agents.effective_runtime_id`/`effective_model_id`/
  `effective_missing` (jsonb string list)/`effective_reported_at`. A
  `CHECK` keeps Computer assignment and desired runtime/model all-or-nothing.
- The Owner↔Agent DM is an ordinary `dm` chat whose peer is an Agent
  (`chats.dm_agent_id`) rather than a second human member. Its `chats_shape`
  branch requires exactly one human member and one Agent.

## Transport

- The Computer attachment socket `hello` carries the sanitized inventory
  alongside the existing handshake. Subsequent `report` messages carry a fresh
  inventory and per-Agent effective state (`agent` entries). A report for an
  Agent not assigned to the reporting Computer updates no row (fail closed).

## API

`grotto.agent.create`, `grotto.agent.configure`, and `grotto.agent.list` are
the Owner/Admin surfaces; `configure` accepts no Computer id because assignment
is immutable. `computer.list` exposes `reportedInventory` to Owners/Admins.
