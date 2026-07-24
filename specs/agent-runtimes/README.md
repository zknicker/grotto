# Agent Runtime Specs

These specs define how Tavern Runtime manages the local agent engine.

Tavern currently supports exactly one local agent runtime namespace. This folder describes the
Tavern-owned runtime boundary so product contracts and naming do not collapse into raw
agent-engine implementation terms.

Tavern Runtime owns local agent execution and maps runtime behavior into Tavern product
primitives.

The specs in this folder are runtime-facing and current-state only. Research notes, sidecar plans,
and migration narratives belong outside `specs/` or should be deleted once superseded.

## Scope

- Local agent lifecycle and primitive ownership.
- Tavern-facing runtime API behavior.
- Agent runtime adapter surfaces.
- Agent event streams and sync expectations.
- Agent security, chat, session, and agent expectations.

Shared Tavern product behavior remains in the top-level specs. Tavern-owned runtime behavior lives
in `../../docs/internals/runtime.md` and the memory specs. Memory is provided by Tavern Runtime to
local agents.

## Specs

- `agent-runtimes.md`: Runtime ownership and local agent mapping model.
- `tavern-messenger.md`: first-party Tavern chat frontend expectations.
- `capability-degradation.md`: capability-level agent degradation model.
- `communication-regression.md`: deterministic agent communication regression scenarios.
- `agents.md`: local agent expectations.
- `chats.md`: local agent chat expectations.
- `sessions.md`: local agent session expectations.
- `security.md`: managed runtime, secret, and execution boundary expectations.
