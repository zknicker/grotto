---
summary: Grotto Computer Agent daemon lifecycle, structured delivery, cursor proofs, crash recovery, and invariant tests.
read_when:
  - changing Computer Agent execution or AI SDK Harness session lifecycle
  - changing Server-to-Computer Agent delivery or busy notices
  - changing accepted, served, or seen semantics
  - changing Agent-authored chain limits or turn failure retry policy
---

# Agent Daemon And Delivery

The product contract lives in
[Raft alignment](../../specs/raft-alignment/README.md),
[Agent Inbox](../../specs/inbox.md), and
[Sessions](../../specs/sessions.md). This document maps those principles to
the Server and Computer implementation.

## Ownership

- Server owns canonical Chats, messages, pending work, delivery state,
  accepted/seen cursors, and the 16-turn Agent chain budget.
- Computer owns one isolated execution host per assigned Agent: workspace,
  HOME, skills, durable inbox acceptance, AI SDK Harness session state, and a
  resident loopback proxy.
- AI SDK Harness remains the execution implementation. A settled turn detaches
  its local session handle, parking the sandbox and resume state for the next
  delivery. Reset or retirement destroys that Agent host.
- The Agent sees only the managed `grotto` wrapper and its stable local proxy
  token. The Computer rotates the Server-valid runner credential for every
  turn and never exposes it to the Agent.

## Delivery State

```text
Server queued work
  -> typed structured inbox
  -> Computer atomic run inbox
  -> accepted ACK
  -> model-visible drain
  -> settled proof
  -> Server seen cursor + consumption
```

Acceptance means only that Computer durably stored the run inbox. It is not
model-seen proof. An accepted run that loses its process before settlement is
replayed at least once. Duplicate effects are preferable to silently dropping
unseen human work.

`seen` is the only consumption authority. A CLI pull advances `served` for
freshness holds, but `served > seen` after a crash leaves the queued row intact
for replay. A completed turn advances `seen`; a failed turn advances it only
when a durable Agent send proves the model handled that prompt.

## Model Projection

Server sends structured inbox rows, never a preformatted model prompt.
Computer renders the exact target, short message id, home-timezone timestamp,
sender type, sender handle, optional sender description, and body defined by
the turn-shape spec.

A fresh session receives `Start.` before its first inbox drain. A busy Agent's
Computer durably receives full new envelopes but injects only the content-free
target/count/id/sender notice. Message bodies enter the model only through a
drain or explicit `grotto message check`.

## Bounds And Failures

One Agent admits one turn at a time; different Agents run concurrently.
Sixteen consecutive drains containing only Agent-authored messages are
allowed. The seventeenth remains queued until human input arrives; any drain
containing human input resets the counter.

Authentication, invalid model/runtime configuration, and oversized input
failures degrade immediately because retrying cannot repair them. Rate limits,
timeouts, transport failures, and unknown failures use the bounded retry
policy. A human Restart clears the failure hold and redrives queued work without
rotating the Agent's session. Raw failure evidence remains Computer-local; the
compact failure kind crosses the Server boundary.

## Invariant Tests

| Principle | Smallest proving lane |
| --- | --- |
| One persistent session; cold `Start.` then resume | `apps/computer/src/harness/executor.test.ts` |
| Stable local proxy; per-turn Server authority rotates | `apps/computer/src/proxy.test.ts` |
| Exact structured drain and content-free busy notice | `apps/computer/src/inbox-format.test.ts` |
| Durable accepted inbox; accepted crash replays | `apps/computer/src/delivery.test.ts`, `apps/computer/src/inbox-store.test.ts` |
| One concurrent turn per Agent | `apps/computer/src/delivery.test.ts` |
| Server resends accepted in-flight work after reconnect | `apps/server/test/agent-delivery.test.ts` |
| `served` cannot consume without `seen` | `apps/server/test/agent-delivery.test.ts` |
| Chain ceiling preserves rows and human input releases it | `apps/server/src/agent-delivery/chain-budget.test.ts`, `apps/server/test/agent-delivery.test.ts` |
| Terminal vs retryable runtime failures | `apps/computer/src/runtime-failure.test.ts`, `apps/server/src/agent-delivery/failure-policy.test.ts` |

These tests are protocol guards. Live Raft-versus-Grotto behavioral scenarios
are a later product audit and do not replace them.
