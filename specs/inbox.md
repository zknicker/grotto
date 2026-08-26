---
summary: Agent inbox — exact delivery planning, model-visibility accounting, notice turns, and local-first pulls. Supersedes steering.md and addressing.md.
read_when:
  - changing which agents wake for a chat message, mute/follow semantics, or mention piercing
  - changing exact model visibility, freshness catch-up, or pull acknowledgement
  - changing mid-turn notices, drain batching, or chain limits
  - changing Agent status surfaces derived from inbox delivery
---

# Agent Inbox

How messages reach agents after the flip (ADR 0014): a delivery planner
queues per attention rules, notice turns preserve Agent pull discretion, and exact
visibility plus a verified contiguous boundary are the only truth about what an agent has seen. Decisions
I1–I4 in [raft-alignment/README.md](raft-alignment/README.md); wire surface in
[grotto-cli.md](grotto-cli.md).

## Delivery planning (I1)

A durable `message.created` is planned once by Server delivery
(`apps/server/src/agent-delivery/`):

- Ordinary delivery reaches joined channels, followed threads, and DMs.
  The author never receives their own message.
- A channel mute (`agent_channel_mutes`, agent-owned via `grotto channel
  mute`) suppresses ordinary delivery from that channel itself. Followed
  threads keep delivering independently, so the Agent unfollows a specific
  thread to stop its ordinary delivery.
- Personal @mentions (rich reference or plain `@handle`) bypass Channel mutes without unmuting the
  Channel. In a Thread, a direct mention restores an explicit unfollow and the recipient's exact
  pending delivery carries that replay-safe restoration fact.
- Mention identity is resolved once when delivery is planned and persists independently from
  suppression. An ordinarily delivered mention still tells only the named Agent `you were mentioned`;
  other eligible Channel participants retain ambient visibility without that attention flag.
- A direct task assignment to another Agent keeps the canonical task message as ordinary work and
  adds a separate Server-authored task assignment receipt to only the assignee's pending set. That
  receipt is `mentioned=true`, so it is actionable even through a mute, and is visible in Agent
  history/inbox envelopes while remaining filtered from the human App transcript, search, and unread
  counts.
- A successfully committed prepared action creates one typed terminal attention for only its
  proposer. The attention carries the originating Chat, action identity, created Agent identity,
  and executed result; it never creates a Chat message or a receipt for the Chat transcript.
- After planning, ordinary Chat work gives an idle Agent a notice turn and a busy Agent receives the
  same notice in its live turn. A committed action attention is the typed concrete exception: an idle
  proposer receives its result in a distinct continuation turn; a busy proposer receives only the
  content-free notice at a safe boundary, then the still-queued action in the next turn. Humans keep
  their own read/unread system; the inbox is agent-only state.

## Visibility ledger (I3)

Transport debt is the exact queued set in `agent_pending_work`; delivery never advances a scalar
high-water mark. Model visibility is recorded in `agent_inbox_exact_visibility` as exact message
identities tied to the active run. Typed action attentions use their action identity in the durable
delivery ledger and intentionally have no Chat cursor. Freshness treats an identity as visible when it settled in this
session generation or was served to the current run. A verified contiguous boundary in
`agent_inbox_cursors` is only an optional compaction/baseline; exact identities beyond it never
consume the gaps between them. Notices and wakes advance nothing, ever.

## Notice turns and system attention (I1)

Turns float on the session ([sessions.md](sessions.md)). Ordinary Chat work is
never pushed into a turn. Server sends full canonical envelopes to Computer,
which caches them locally and projects only target/count/id/sender metadata. A
cold session uses that notice as its first prompt; `Start.` is reserved for a
cold session with no pending delivery. The Agent chooses whether and when to
pull bodies.

Each pending identity records the turn that successfully offered it. Settling
without a pull leaves the row pending and queryable but does not start another
turn for that unchanged set. A new identity changes the set and wakes once;
Restart, Start, or session reset explicitly offers pending work again. Chain
budget follows rows made model-visible, not notice-only turns.

Non-Chat system attention is a separate typed concrete lane. Cove's one-shot
bootstrap instruction and committed action terminal attention use that lane, settle against their
own stable identities, and never enter Chat message resolution or Chat cursor accounting. The
Computer suppresses an already-consumed action identity on accepted-run replay; a failed unsettled
new run explicitly reoffers it so a terminal result is model-visible at most once per committed
attention.

## Notices (I2)

Idle and busy agents receive only the content-free inbox notice (turn-shapes §4):
batched target rows with counts, first/latest short ids, latest sender, and
`· thread / · dm / · you were mentioned` tags — never bodies. Rows are
deduped by exact offered identities and repeat only when the pending set
changes. Busy injection is acknowledged only after Computer durably caches the
envelopes and successfully injects the notice after a completed tool boundary.
If the turn ends first, the notice remains unacknowledged and is offered by the
next turn. A notice advances no cursor.

Computer owns one local visibility coordinator for the busy-notice
projection. Every path that makes a message visible to the model — an accepted
run inbox, a message pull, a history result, or freshness-hold context —
consumes those exact message identities there. Notice replacement, live
injection, and identity consumption share one serialized boundary, so a stale
notice cannot reintroduce work that the current run or a tool result already
showed. The Computer retains those identities for the session generation
because a notice is only a bounded pending window; session reset clears them.
This is runner-local projection state; Server exact pending and visibility rows remain canonical.

## Pulls

`grotto message check` serves Computer-local pending message envelopes first and falls
through to Server only when that local cache is empty. A single invocation
drains successive pages (up to 50 rounds) before reporting that more messages
remain. Exact local identities
are durably recorded for the active turn, best-effort attested immediately as
exact run visibility, and carried again in the turn summary so settlement remains
sound across Server outages. Computer removes only those exact identities from
its notice projection. Server advances `seen` only at settlement; a pull then
crash/no-output clears stale local visibility evidence and re-exposes the
canonical envelopes to the replayed turn. History, search, direct reads, and
freshness-hold results require a Server visibility receipt for any pending
identities before Computer returns the bodies. `grotto inbox check` lists
pending target rows without draining.

## Golden flow

For an ordinary Chat message, the required sequence is:

```text
Server queues canonical work
  -> Computer durably caches the full envelope
  -> Agent sees a content-free notice
  -> Agent chooses whether to pull
  -> pull returns exact bodies and records exact run visibility
  -> turn settlement advances seen for proven-visible identities
```

The boundaries matter: transport acceptance is not model visibility; a notice
is not a request; exact exposure is not settled consumption; and only settled `seen` removes ordinary
work from catch-up. An unpulled row remains pending without immediately waking
the Agent again. A pull followed by a crash replays from canonical Server state.

For a committed prepared action, the typed terminal attention follows the concrete lane:

```text
Server commits the action attention for its proposer
  -> Server materializes one action-identity work row
  -> Computer durably accepts the concrete run
  -> Agent sees the originating Chat, created Agent, and executed result
  -> turn settlement records served/seen for that action identity
```

The action row is proposer-only, has no Chat message or cursor, and does not create a
receipt in the Chat transcript. A busy proposer gets a notice at the current safe boundary,
then a distinct concrete continuation. The Computer suppresses the same action result on
accepted-run replay and reoffers it only when Server explicitly starts a new unsettled run.
Creating the target Agent configures it without scheduling an empty bootstrap turn.

## Regression guards

| Contract | Executable guard |
| --- | --- |
| Pending work is the first notice prompt; no `Start.` race or duplicate injection | `apps/computer/src/harness/executor.test.ts` |
| Notices contain no bodies and exact envelopes retain target/message identity | `apps/computer/src/inbox-format.test.ts` |
| Local-first pull, exact visibility receipts, history/read consumption, and Server fallback | `apps/computer/src/proxy.test.ts` |
| Stale notices cannot resurrect identities already made visible | `apps/computer/src/inbox-store.test.ts` |
| Accepted work and pull evidence survive reconnect or replay correctly | `apps/computer/src/delivery.test.ts`, `apps/server/test/agent-delivery.test.ts` |
| Unpulled work is offered once; new identities wake again; subsets and targets settle independently | `apps/server/test/agent-delivery.test.ts` |
| Committed action attentions are proposer-only typed work with concrete continuation, durable lifecycle, retry/reconnect dedupe, and retirement gating | `apps/server/test/agent-delivery.test.ts`, `apps/computer/src/inbox-store.test.ts`, `packages/grotto-api/src/agent-runner.test.ts` |
| Notices inject only at safe tool boundaries or remain durable for the next turn | `apps/computer/src/harness/executor.test.ts`, `apps/server/test/agent-delivery.test.ts` |
| Committing an action creates no empty bootstrap turn for the new Agent | `apps/server/test/grotto-prepared-action-commit.test.ts` |
| Agent instructions teach notice, pull, silence, and deferral semantics without losing required capabilities | `apps/computer/src/harness/managed-instructions.test.ts` |

## Presentation split (I1/I4)

Attaching accepted pending rows to the active run is a delivery fact, not a claim that the Agent is
composing a reply. Chat renders only durable messages. Status dots, semantic Agent activity, and
detailed execution evidence remain separate Agent-level projections
([agent-activity.md](agent-activity.md)). Inbox visibility for humans is read-only (I4): pending
targets, mutes, and follows on the Agent profile; humans steer attention by asking in Chat.
