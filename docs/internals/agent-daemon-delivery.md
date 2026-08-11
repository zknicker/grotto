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
  -> full envelope in Computer-local pending inbox
  -> accepted ACK
  -> content-free notice
  -> Agent-chosen local message check
  -> exact visibility receipt
  -> settled proof
  -> Server seen cursor + consumption
```

Acceptance means only that Computer durably stored the run inbox. It is not
model-seen proof. An accepted run that loses its process before settlement is
replayed at least once. Duplicate effects are preferable to silently dropping
unseen human work.

`seen` is the only consumption authority. A CLI pull serves Computer-local
bodies first, attaches exact identities to that run, and advances `served` for
freshness holds. Settlement advances `seen` for exact pulled identities and
for concrete typed-attention or replay identities proven visible in that turn,
so already-handled work does not start a redundant turn. If the process crashes
first, the attached rows remain durable under the unsettled run and replay with
it. A failed turn advances `seen` only when a durable Agent send proves the
model handled that prompt.

## Model Projection

Server sends structured inbox rows, never a preformatted model prompt.
Computer renders the exact target, short message id, home-timezone timestamp,
sender type, sender handle, optional sender description, and body defined by
the turn-shape spec.

A fresh session uses its initial content-free notice as the first prompt;
`Start.` is used only when no delivery is pending. A reset recovery line
precedes whichever first prompt applies. A different notice arriving during
cold startup remains durable and is offered after that turn instead of racing
a mid-turn injection. Idle and busy Agents durably receive full envelopes but
project only target/count/id/sender metadata. Message bodies enter the model
only through explicit `grotto message check`, history/hold context, or the
typed non-Chat system-attention lane.

Busy notices queue behind the active turn and inject only after a completed
tool boundary. Computer acknowledges the notice after that injection succeeds;
when no safe boundary remains, the durable notice is left unacknowledged for
the next turn instead of being accepted too late for the model to observe it.

Computer reconciles every model-visible message through one exact-identity
consume point. Accepted run inboxes and successful Agent API responses
(`events`, `history`, and freshness-hold context) remove their identities from
the local pending projection. Snapshot replacement and live notice injection
use the same serialized write boundary. Consumed identities remain attached for
the session generation because each notice carries only a bounded pending
window, preventing omitted or older in-flight rows from resurrecting a stale
notice. A session reset clears this projection. Local pulls also write
run-scoped visibility evidence: Computer attempts an immediate Server receipt
for freshness and repeats the identities in the turn summary. Server remains
canonical and advances `seen` only on settlement.

System attention that is not itself a Chat message, including Cove's one-shot
first-greeting request, uses the same structured run inbox and exact-identity
Computer replay. It is intentionally absent from Chat cursor accounting. Its
owning Server record prevents recreation after settlement; the Computer still
replays the same run id until its durable marker is settled.

Task messages use the same inbox path as ordinary messages and carry their
canonical task number, state, priority, and assignee metadata. A mention may
pierce a Channel mute or explicit Thread unfollow exactly once. That pierce is
stored separately from the ordinary Chat cursor, so direct attention neither
unmutes the Channel nor re-follows the Thread. Muting or unfollowing purges
already-queued ordinary work for that attention scope.

An Agent-created peer assignment is direct attention without a synthetic
receipt message. The Server creates the canonical task message once, reserves
its single ownership slot for the peer, follows the deterministic task Thread
for that peer, and enqueues a pierced delivery for only that Agent.

## Long-Horizon Continuity

Computer maintains one resident execution host and one global model session
per assigned Agent. The session spans every Chat and does not rotate because
of age or idle time. A settled turn parks its harness state for the next
delivery; a Computer restart resumes that stored state.

Initial creation, runtime or model switch, and manual session reset start a
fresh session. If the harness rejects stored resume state, Computer discards
only that state, advances the generation, and cold-starts once. The Agent then
recovers durable context from its unchanged `MEMORY.md`, notes, and canonical
Server history.

Session reset preserves workspace, skills, identity, and Server history. Full
reset restores the persisted Agent kind's factory workspace—minimal
`MEMORY.md` for ordinary Agents or Cove's exact onboarding seed—and only the
current factory-managed skills. Retirement is the only normal lifecycle
operation that removes the Agent execution host.

Human Restart is distinct from session reset. Server requires the assigned
Computer to be online, stops any active run, and sends an `agent-restart`
command before redriving pending work. Computer records that command durably,
recreates the runner boundary, resumes the same native conversation, and
applies the latest composed instructions exactly once on the next delivery.
Ordinary resume never redelivers instructions.

Reminders are canonical Server schedules anchored to an Agent and Chat
target. When due, they enter the same delivery path as other work. Computer
executes the resulting turn; it does not own an independent reminder
scheduler.

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

## App Work Projection

Delivery state is durable; its live App projection is not. The Server emits three coarse lifecycle
phases from product boundaries:

| Phase | Projection point | App meaning |
| --- | --- | --- |
| `working` | A start command reaches the assigned Computer | Agent availability becomes busy |
| `reading` | The Computer accepts the run, or an Agent send finishes | Agent remains coarsely busy |
| `settled` | The active run completes, fails, or is stopped | Reconcile Agent availability, delivery state, and durable Activity |

Lifecycle remains the coarse availability projection. ADR 0023 adds a separate semantic Agent
activity journal: Computer maps known Harness and product boundaries into safe categories, Server
persists them, and the sidebar strip projects the latest category for each unsettled Agent. Unknown
and MCP tools remain generic. Neither lifecycle nor semantic activity carries arguments, command
contents, model reasoning, draft messages, tool outputs, or private file contents.

Computer separately records a detailed execution journal keyed by run. Owner/Admin inspection uses
an authorized live relay; Server never persists that response. Chat receives only the ephemeral
typing indicator described by `specs/typing-indicators.md`, backed for Agents by run-attached inbox
work. The old `sending` composition bubble and compositionId handoff are removed.

## Invariant Tests

| Principle | Smallest proving lane |
| --- | --- |
| One persistent session; pending delivery or cold `Start.`, then resume | `apps/computer/src/harness/executor.test.ts` |
| Restart preserves generation and refreshes instructions exactly once | `apps/server/test/agent-delivery.test.ts`, `apps/computer/src/harness/executor.test.ts`, `apps/computer/src/harness/session-restart.test.ts` |
| Known tools map through the semantic registry; unknown and MCP tools remain generic | `apps/computer/src/harness/executor.test.ts` |
| Runtime/model switch and rejected resume start exactly one fresh generation | `apps/computer/src/harness/executor.test.ts` |
| Session reset preserves workspace and skills; full reset restores the Agent-kind workspace and only factory-managed skills | `apps/computer/src/launch.test.ts` |
| Stable local proxy; per-turn Server authority rotates | `apps/computer/src/proxy.test.ts` |
| Exact message envelopes and content-free notices | `apps/computer/src/inbox-format.test.ts` |
| Every model-visible identity consumes one local notice contribution | `apps/computer/src/inbox-store.test.ts`, `apps/computer/src/proxy.test.ts` |
| Live notice injection cannot race accepted-run consumption | `apps/computer/src/inbox-store.test.ts`, `apps/computer/src/harness/executor.test.ts` |
| Pipe and redirected-file input reach the managed Agent CLI | `apps/computer/src/agent-cli/stdin.test.ts` |
| Durable accepted inbox; accepted crash replays | `apps/computer/src/delivery.test.ts`, `apps/computer/src/inbox-store.test.ts` |
| One concurrent turn per Agent | `apps/computer/src/delivery.test.ts` |
| Server resends accepted in-flight work after reconnect | `apps/server/test/agent-delivery.test.ts` |
| Busy pull settles with its active run; unsettled pull replays | `apps/server/test/agent-delivery.test.ts` |
| `served` cannot consume without `seen` | `apps/server/test/agent-delivery.test.ts` |
| Chain ceiling preserves rows and human input releases it | `apps/server/src/agent-delivery/chain-budget.test.ts`, `apps/server/test/agent-delivery.test.ts` |
| Terminal vs retryable runtime failures | `apps/computer/src/runtime-failure.test.ts`, `apps/server/src/agent-delivery/failure-policy.test.ts` |
| Dispatch, acceptance, and settlement project semantic lifecycle phases | `apps/server/test/agent-delivery.test.ts` |
| Agent Chat engagement starts from accepted run-attached inbox work and clears at every terminal path | `apps/server/test/agent-delivery.test.ts`, `apps/server/test/grotto-agent-run.test.ts` |
| `As Task` enters the inbox with canonical task metadata | `apps/server/test/grotto-agent-run.test.ts`, `apps/computer/src/inbox-format.test.ts` |
| Fresh Agent Thread replies materialize the authorized anchor | `apps/server/test/grotto-agent-run.test.ts` |
| Mute/unfollow purge ordinary work; mentions pierce without changing attention state | `apps/server/test/grotto-agent-run.test.ts` |
| Freshness validation and Agent send commit share one Server lock | `apps/server/test/grotto-agent-run.test.ts` |
| Human and Agent claims share one ownership lock | `apps/server/test/grotto-agent-run.test.ts` |
| Agent peer assignment is idempotent, follows its Thread, and wakes only the peer | `apps/server/test/grotto-agent-run.test.ts` |
| Agent retirement releases task ownership and emits durable updates | `apps/server/test/grotto-agents.test.ts` |

These tests are protocol guards. Live Raft-versus-Grotto behavioral scenarios
are a later product audit and do not replace them.
