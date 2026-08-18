---
summary: Turn activity presentation from durable Server evidence and Computer-relayed execution details.
read_when:
  - changing turn activity rows or the turn-details drawer
  - changing execution-journal presentation or access
  - adding presentation for a Computer-reported tool event
---

# Turn Activity Presentation

Grotto Server owns the durable product timeline. Computer owns execution state
and runtime access. The App presents those sources through an App-owned
transcript contract; it does not call an execution runtime or a retired local
Server API directly.

## Data paths

Durable messages and semantic turn activity are read from Grotto Server and
projected by `features/servers/chat/` into
`features/chats/transcript-contract.ts`. Transcript components render only that
presentation contract.

Detailed execution is optional, ephemeral evidence. When an authorized user
opens `server-turn-details-drawer.tsx`,
`use-agent-execution-journal.ts` asks Grotto Server for one run. Server relays
the request to the Agent's assigned Computer. The result deliberately bypasses
React Query: it is neither canonical collaboration state nor a durable App
cache entry.

## Rules

- Product history remains useful while Computer is offline. Missing execution
  detail degrades the drawer; it never removes or gates the transcript.
- The App sends Server, Agent, and run identity. It never chooses a runtime
  base URL, auth token, runtime session, or runtime-specific chat id.
- Reusable row, actor, composer, and drawer types belong to the App feature.
  Boundary adapters may consume `@tavern/api`; presentation components must not
  import a Server router merely to inherit its output types.
- Semantic activity is the default human-readable evidence. Raw execution
  journal data is restricted to the access policy enforced by Server.
- Tool-specific labels and bodies may extend the App registries, but their
  input must come through the transcript contract or execution journal path.
  They must not restore a direct Runtime fetch.
