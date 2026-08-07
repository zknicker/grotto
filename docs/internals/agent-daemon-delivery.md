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

`seen` is the only consumption authority. A CLI pull during an accepted run
attaches the returned rows to that run and advances `served` for freshness
holds. Settlement advances `seen` for both the original drain and those pulled
rows, so already-handled work does not start a redundant turn. If the process
crashes first, the attached rows remain durable under the unsettled run and
replay with it. A failed turn advances `seen` only when a durable Agent send
proves the model handled that prompt.

## Model Projection

Server sends structured inbox rows, never a preformatted model prompt.
Computer renders the exact target, short message id, home-timezone timestamp,
sender type, sender handle, optional sender description, and body defined by
the turn-shape spec.

A fresh session receives `Start.` before its first inbox drain. A busy Agent's
Computer durably receives full new envelopes but injects only the content-free
target/count/id/sender notice. Message bodies enter the model only through a
drain or explicit `grotto message check`.

Computer reconciles every model-visible message through one exact-identity
consume point. Accepted run inboxes and successful Agent API responses
(`events`, `history`, and freshness-hold context) remove their identities from
the local pending projection. Snapshot replacement and live notice injection
use the same serialized write boundary. Consumed identities remain attached for
the session generation because each notice carries only a bounded pending
window, preventing omitted or older in-flight rows from resurrecting a stale
notice. A session reset clears this projection. This local state never replaces
Server `served` or `seen` authority.

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
reset restores an ordinary Agent's minimal `MEMORY.md` and factory-managed
skills. Retirement is the only normal lifecycle operation that removes the
Agent execution host.

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

## App Lifecycle Projection

Delivery state is durable; its live App projection is not. The Server emits
four semantic lifecycle phases from product boundaries:

| Phase | Projection point | App meaning |
| --- | --- | --- |
| `working` | A start command reaches the assigned Computer | Agent availability becomes busy |
| `reading` | The Computer accepts the run, or an Agent send finishes | Agent remains coarsely busy |
| `sending` | The Agent message-send request is recording its durable message | Show one provisional bubble at that exact Chat or thread |
| `settled` | The active run completes, fails, or is stopped | Reconcile Agent availability, delivery state, and durable Activity |

These events carry no reasoning or tool transcript and are neither stored nor
replayed. The Agent profile's Activity tab remains the durable, turn-grained
execution evidence surface. Its compact turn summary may include a bounded set
of tool names observed in the harness stream, but never arguments, command
contents, model reasoning, or private file contents. Chat receives only the
short-lived `sending` composition bubble; every other lifecycle phase is
presentation plumbing.

## Invariant Tests

| Principle | Smallest proving lane |
| --- | --- |
| One persistent session; cold `Start.` then resume | `apps/computer/src/harness/executor.test.ts` |
| Restart preserves generation and refreshes instructions exactly once | `apps/server/test/agent-delivery.test.ts`, `apps/computer/src/harness/executor.test.ts`, `apps/computer/src/harness/session-restart.test.ts` |
| Tool names become bounded safe Activity evidence | `apps/computer/src/harness/executor.test.ts` |
| Runtime/model switch and rejected resume start exactly one fresh generation | `apps/computer/src/harness/executor.test.ts` |
| Session reset preserves workspace; full reset restores only minimal memory and factory-managed skills | `apps/computer/src/launch.test.ts` |
| Stable local proxy; per-turn Server authority rotates | `apps/computer/src/proxy.test.ts` |
| Exact structured drain and content-free busy notice | `apps/computer/src/inbox-format.test.ts` |
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
| Agent sends project a target-scoped provisional composition | `apps/server/test/grotto-agent-run.test.ts`, `apps/website/src/features/servers/hosted-agent-composition-bubble.test.tsx` |
| `As Task` enters the inbox with canonical task metadata | `apps/server/test/grotto-agent-run.test.ts`, `apps/computer/src/inbox-format.test.ts` |
| Fresh Agent Thread replies materialize the authorized anchor | `apps/server/test/grotto-agent-run.test.ts` |
| Mute/unfollow purge ordinary work; mentions pierce without changing attention state | `apps/server/test/grotto-agent-run.test.ts` |
| Freshness validation and Agent send commit share one Server lock | `apps/server/test/grotto-agent-run.test.ts` |
| Human and Agent claims share one ownership lock | `apps/server/test/grotto-agent-run.test.ts` |
| Agent peer assignment is idempotent, follows its Thread, and wakes only the peer | `apps/server/test/grotto-agent-run.test.ts` |
| Agent retirement releases task ownership and emits durable updates | `apps/server/test/grotto-agents.test.ts` |

These tests are protocol guards. Live Raft-versus-Grotto behavioral scenarios
are a later product audit and do not replace them.
