# Agent Runtime Security

Agent runtime security defines how Grotto Runtime manages local execution while keeping secrets, execution, and
runtime boundaries explicit.

## Product Expectations

- Runtime-owned provider credentials stay in Runtime-owned secret storage.
- Grotto-configured provider credentials stay in Runtime-owned configuration.
- Grotto Runtime generates local runtime credentials; the app should not expose them.
- Grotto App does not read agent-engine secrets directly.
- Grotto App does not read agent-engine SQLite databases, config files, identity files, or home directories
  directly.
- Grotto Runtime writes generated agent config. Other agent management happens
  through supported Runtime APIs.
- Unsupported agent capabilities should fail visibly rather than silently escalating access.

## Execution Boundary

- Grotto Runtime must launch local execution with macOS Seatbelt guardrails when supported.
- Local execution runs as the current user with the normal user environment, including the user's
  `HOME`.
- Seatbelt is not a container boundary. Strong isolation belongs in Docker, a VM, a separate macOS
  user, or a separate machine.
- Runtime remains responsible for runtime/tool policy inside the guarded process tree.
- Grotto may display Runtime-reported security and permission state, but product enforcement starts
  with the managed Runtime launch policy.

## Secrets

- Provider credentials entered through Grotto stay in Runtime-owned configuration.
- MCP connection credentials stay in the Runtime vault and are used only at
  the upstream MCP boundary.
- Grotto-owned memory secrets stay in Runtime.
- Logs, setup status, model-access status, and app UI must not include raw secret values.

## Permissions

- Broader agent-engine administration should require a management surface intended for that purpose.
- Agent-facing tools that can update memory or identity should be constrained by Runtime's own
  tool and filesystem boundaries.
- Grotto should not use agent IPC or agent prompts as the normal authorization path for operator
  configuration.

## Safety Expectations

- A failed sync should not corrupt runtime config.
- A failed turn should not corrupt unrelated Grotto records.
- Agent-engine failure should be visible and attributable to the failing capability or sync
  path.
- Security boundaries should remain understandable from the Grotto Runtime and agent-engine
  surfaces.
