---
summary: Decision to project Agent work as durable semantic Server activity, ephemeral Chat engagement, and Computer-local detailed execution evidence.
read_when:
  - changing Agent activity, typing indicators, or status presentation
  - changing Server/Computer ownership of execution evidence
  - changing inbox visibility or Chat-scoped realtime events
---

# ADR 0023: Agent Work Projects as Activity and Chat Engagement

## Status

Accepted 2026-08-11. Amends ADR 0014's provisional composition stream and ADR 0019's execution
evidence boundary without changing CLI-only output or Agent-global sessions.

## Context

Grotto previously exposed ongoing Agent work primarily through one global status dot. Its durable
Activity feed retained only coarse turn outcomes. A provisional transcript bubble attempted to
represent an in-flight `grotto message send`, but hosted Server emitted its `sending` phase after
message commit and immediately moved on, so users normally saw the final response appear at once.

Literal Agent composition cannot be detected reliably across Codex, Claude, and Pi. Grotto turns
float on one Agent-global session, may read several Chats, and speak only through a generated CLI
command. Harness text deltas have no trustworthy Chat target, while complete tool-call arguments
arrive too late to serve as useful typing state.

At the same time, moving raw tool arguments and results into Server persistence would break the
existing boundary: Server owns collaboration, while Computer owns detailed execution, workspaces,
provider state, and raw evidence.

## Decision

Grotto exposes Agent work through three distinct projections:

1. **Agent activity** is safe semantic execution metadata. Computer maps only known tool identities
   and structured product boundaries into a small category catalog; unknown tools use a generic
   fallback. Server persists this journal and projects it into Activity History and the live
   sidebar strip.
2. **Agent Chat engagement** is the run-scoped fact that an active accepted turn has attached
   pending inbox work from a Chat. Server projects engagement into that Chat's `is typing…` UI. It
   does not claim literal composition or promise a reply.
3. **Agent execution journal** is detailed tool evidence stored on Computer. Owners and Admins may
   inspect it through an authorized live relay. Server does not persist it, and detail is unavailable
   while Computer is offline.

Human typing and Agent engagement share a Chat-scoped ephemeral event and UI contract. Human clients
publish small active/inactive pulses over the existing authenticated WebSocket; they never send
draft text. Agent events come only from Server inbox and lifecycle state.

The provisional transcript composition bubble, draft-text stream, and hosted `sending` lifecycle
presentation are removed. Agent messages remain complete, durable CLI sends.

## Consequences

- The sidebar can show current work across the Server without exposing raw execution.
- Activity History survives Computer downtime and reloads.
- Turn Details can show summarized Server evidence to authorized Chat readers and detailed local
  evidence only to Owners/Admins while Computer is online.
- One Agent may appear as typing in several Chats during one turn and may send no reply.
- Tool classification must be explicit and conservative; MCP and unknown tools default to
  `Using a tool…`.
- Computer must create a queryable local execution journal and a typed inspection relay.
- Server needs a durable semantic activity journal plus a separate volatile Chat typing lane.
- This work adds no retention or cleanup behavior. PRD-216 owns that policy holistically.

## Rejected alternatives

- **First model text delta:** a floating turn has no trustworthy Chat target and CLI-only output
  makes model text non-canonical.
- **First streamed `message send` argument:** not consistently observable across Harness adapters
  and still arrives late.
- **Explicit Agent typing command:** provider-neutral but adds a model-taught round trip for a fact
  already available from inbox visibility.
- **Turn-start typing:** marks a seed Chat even when the Agent handles unrelated pending work.
- **Server-persisted raw tool evidence:** violates the established Server/Computer privacy boundary.
- **Computer lookup for Activity History:** makes an ordinary collaboration surface unavailable
  offline and turns history reads into remote machine operations.
