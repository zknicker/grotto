---
summary: Runtime Doctor architecture for modular startup, repair, health, and setup checks.
read_when:
  - changing Runtime startup checks, repair flows, or health recomputation
  - changing model provider setup or Agent default repair
  - adding a manual Check now action or scheduled Runtime maintenance
---

# Runtime Doctor

Runtime Doctor is Grotto Runtime's modular maintenance runner. It checks local
state, repairs derived Runtime-owned records, and publishes capability health.
It keeps setup and repair work out of turn execution.

Doctor modules are code-owned maintenance units. Each module can run at Runtime
startup, after a related mutation, on a manual check, or on a scheduled check.

## Contract

- **Runtime owns Doctor.** Grotto App may request a check and render results,
  but Runtime performs checks and repairs.
- **Modules are invocable.** Each Doctor module has a stable id, run reason,
  scope, and result.
- **Repair is proactive.** Startup and setup mutations repair Runtime state
  before users start agent work.
- **Execution still guards invariants.** Agent turn start validates that
  required Runtime state exists, but it is not the normal repair point.
- **Results are structured.** Modules report repaired records, blockers,
  warnings, and capability updates.

## Modules

Doctor modules stay narrow and composable.

| Module | Owns | Common triggers |
| --- | --- | --- |
| `models` | Provider access checks, executable model inventory, and `modelExecution` capability. | Runtime start, provider add/remove, credential save, OAuth change, manual check, scheduled check. |
| `agents` | Built-in Agent DM repair and Agent default model repair from executable model inventory. | Runtime start after `models`, provider/access change after `models`, Agent settings mutation, manual check. |

Modules can depend on earlier modules. A provider mutation runs `models` then
`agents`; an Agent default edit can run only `agents` for that Agent.

## Scope

Modules accept the smallest useful scope:

```ts
type DoctorScope =
  | { kind: 'all' }
  | { kind: 'agent'; agentId: string }
  | { kind: 'provider'; providerId: string };
```

Provider changes use provider or all scope for `models`, then all scope for
`agents` because any Agent default may reference the changed provider.

Agent settings mutations use agent scope. They validate the requested default
against executable model inventory and then repair only that Agent if needed.

## Model Repair

The `models` module computes executable model inventory and writes
`modelExecution` healthy when at least one executable model exists.

The `agents` module first ensures each Runtime-managed agent has one built-in
DM with the local human operator, then applies the model defaulting policy:

1. Saved default executable: keep it.
2. Saved default invalid or unavailable: repair to the highest-ranked
   executable model.
3. No saved default: set the highest-ranked executable model.
4. No executable models: leave the Agent unresolved and report a setup blocker.

The repair policy treats Agent default models as recoverable preferences. Grotto
does not silently preserve a broken preference when another executable model can
run the Agent.

## Triggers

- **Runtime startup.** Run the baseline module chain and publish capability
  health before the app relies on agent execution controls.
- **Provider/access mutation.** Run `models`, then `agents`.
- **Agent default mutation.** Validate directly, then run `agents` with agent
  scope when repair is needed.
- **Manual check.** Run the requested module or baseline chain and return a
  structured result to the caller.
- **Scheduled check.** Refresh external state that can drift outside Grotto,
  such as CLI OAuth files or provider credentials.

## Result Shape

Doctor results carry product facts, not log strings:

```ts
type DoctorResult = {
  moduleId: string;
  reason: string;
  scope: DoctorScope;
  status: 'healthy' | 'repaired' | 'blocked' | 'degraded';
  repaired: Array<{ kind: string; id: string; summary: string }>;
  blockers: Array<{ kind: string; id: string; action: string }>;
  warnings: Array<{ kind: string; id: string; message: string }>;
  capabilityUpdates: Array<{ capability: string; healthy: boolean }>;
};
```

The App can render these results in Settings or a manual check surface. Runtime
capability rows remain the source of truth for feature gating.
