---
summary: Agent inbox — delivery planning, the two-cursor ledger, notice turns, and local-first pulls. Supersedes steering.md and addressing.md.
read_when:
  - changing which agents wake for a chat message, mute/follow semantics, or mention piercing
  - changing delivered/seen cursors, freshness catch-up, or pull acknowledgement
  - changing mid-turn notices, drain batching, or chain limits
  - changing Agent status surfaces derived from inbox delivery
---

# Agent Inbox

How messages reach agents after the flip (ADR 0014): a delivery planner
queues per attention rules, notice turns preserve Agent pull discretion, and the
two-cursor ledger is the only truth about what an agent has seen. Decisions
I1–I4 in [raft-alignment/README.md](raft-alignment/README.md); wire surface in
[grotto-cli.md](grotto-cli.md).

## Delivery planning (I1)

A durable `message.created` is planned once by Server delivery
(`apps/server/src/agent-delivery/`):

- Ordinary delivery reaches joined channels, followed threads, and DMs.
  The author never receives their own message.
- A channel mute (`agent_channel_mutes`, agent-owned via `grotto channel
  mute`) suppresses the channel and its threads; thread follow records
  survive a mute.
- Personal @mentions (rich reference or plain `@handle`) pierce mutes and
  unfollows as single messages (`agent_inbox_pierces`) that do not
  re-follow and never move the muted target's `delivered` cursor.
- After planning, an idle agent gets a notice turn; a busy agent receives the
  same notice in its live turn. Humans keep their own read/unread system; the inbox
  is agent-only state.

## Two-cursor ledger (I3)

Per (session, target) in `agent_inbox_cursors`:

- `delivered` — transport state: what the inbox has queued. Muted targets
  never advance it.
- `seen` — the sole model-seen authority for freshness holds and catch-up.
  Advances only on proof: concrete typed system attention when the turn settles;
  exact pull outputs recorded against the active turn
  (observed as served-cursor movement between turn start and settle); hold
  catch-up rows when shown. Notices and wakes advance nothing, ever.

`served` (`agent_session_served_cursors`) remains the hold-decision assist
(ruling W1a): pulls advance it immediately so a pull-then-send never
spuriously holds. A turn that pulled and died leaves `served > seen`;
catch-up re-delivers from `seen` — duplicate envelopes after crashes are by
design. Session resets start fresh cursor horizons.

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
bootstrap instruction uses that lane, settles against its own identity, and
never enters Chat message resolution or Chat cursor accounting.

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
This is runner-local projection state; Server cursors remain the canonical
delivery and seen ledger.

## Pulls

`grotto message check` serves Computer-local pending envelopes first and falls
through to Server only when that local cache is empty. Exact local identities
are durably recorded for the active turn, best-effort attested immediately to
advance `served`, and carried again in the turn summary so settlement remains
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
  -> pull returns exact bodies and advances served
  -> turn settlement advances seen for proven-visible identities
```

The boundaries matter: transport acceptance is not model visibility; a notice
is not a request; `served` is not consumption; and only `seen` removes ordinary
work from catch-up. An unpulled row remains pending without immediately waking
the Agent again. A pull followed by a crash replays from canonical Server state.

## Regression guards

| Contract | Executable guard |
| --- | --- |
| Pending work is the first notice prompt; no `Start.` race or duplicate injection | `apps/computer/src/harness/executor.test.ts` |
| Notices contain no bodies and exact envelopes retain target/message identity | `apps/computer/src/inbox-format.test.ts` |
| Local-first pull, exact visibility receipts, history/read consumption, and Server fallback | `apps/computer/src/proxy.test.ts` |
| Stale notices cannot resurrect identities already made visible | `apps/computer/src/inbox-store.test.ts` |
| Accepted work and pull evidence survive reconnect or replay correctly | `apps/computer/src/delivery.test.ts`, `apps/server/test/agent-delivery.test.ts` |
| Unpulled work is offered once; new identities wake again; subsets and targets settle independently | `apps/server/test/agent-delivery.test.ts` |
| Notices inject only at safe tool boundaries or remain durable for the next turn | `apps/computer/src/harness/executor.test.ts`, `apps/server/test/agent-delivery.test.ts` |
| Agent instructions teach notice, pull, silence, and deferral semantics without losing required capabilities | `apps/computer/src/harness/managed-instructions.test.ts` |

## Presentation split (I1/I4)

Attaching accepted pending rows to the active run is a delivery fact, not a claim that the Agent is
composing a reply. Chat renders only durable messages. Status dots, semantic Agent activity, and
detailed execution evidence remain separate Agent-level projections
([agent-activity.md](agent-activity.md)). Inbox visibility for humans is read-only (I4): pending
targets, mutes, and follows on the Agent profile; humans steer attention by asking in Chat.
