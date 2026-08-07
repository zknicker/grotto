# Agent Runtime Specs

These specs define how Grotto Runtime manages the local agent engine.

Grotto currently supports exactly one local agent runtime namespace. This folder describes the
Grotto-owned runtime boundary so product contracts and naming do not collapse into raw
agent-engine implementation terms.

Grotto Runtime owns local agent execution and maps runtime behavior into Grotto product
primitives.

The specs in this folder are runtime-facing and current-state only. Research notes, sidecar plans,
and migration narratives belong outside `specs/` or should be deleted once superseded.

## Scope

- Local agent lifecycle and primitive ownership.
- Grotto-facing runtime API behavior.
- Agent runtime adapter surfaces.
- Agent event streams and sync expectations.
- Agent security, chat, session, and agent expectations.

Shared Grotto product behavior remains in the top-level specs. Grotto-owned runtime behavior lives
in `../../docs/internals/runtime.md` and the memory specs. Memory is provided by Grotto Runtime to
local agents.

## Specs

- `agent-runtimes.md`: Runtime ownership and local agent mapping model.
- `tavern-messenger.md`: first-party Grotto chat frontend expectations.
- `capability-degradation.md`: capability-level agent degradation model.
- `communication-regression.md`: deterministic agent communication regression scenarios.
- `agents.md`: local agent expectations.
- `chats.md`: local agent chat expectations.
- `sessions.md`: local agent session expectations.
- `security.md`: managed runtime, secret, and execution boundary expectations.
