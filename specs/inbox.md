---
summary: Agent inbox — the `agent_inbox` item kinds and their one lifecycle, exact delivery planning, model-visibility accounting, notice turns, local-first pulls, and cause inference on send. Supersedes steering.md and addressing.md.
read_when:
  - adding an agent inbox item kind, or changing an item's identity or lifecycle
  - changing which agents wake for a chat message, mute/follow semantics, or mention piercing
  - changing exact model visibility, freshness catch-up, or pull acknowledgement
  - changing mid-turn notices, drain batching, or chain limits
  - changing how the Server infers which fire caused an Agent's message
  - changing Agent status surfaces derived from inbox delivery
---

# Agent Inbox

The agent inbox is the only lane that carries work no human sees, and `agent_inbox`
is the table that holds it (ADR 0026). Everything an Agent is given to act on is an
inbox item: a delivery planner queues items per attention rules, notice turns preserve
Agent pull discretion, and exact visibility plus a verified contiguous boundary are the
only truth about what an agent has seen. Decisions I1–I4 in
[raft-alignment/README.md](raft-alignment/README.md); wire surface in
[grotto-cli.md](grotto-cli.md).

## Item kinds and lifecycle

Every row is one item with a stable identity that is never a message id except for
ordinary Chat work, the rendered envelope as its content, and the recipient Agent.

| Kind (`source`) | What it is | Identity | Lane |
| --- | --- | --- | --- |
| `human` | An ordinary Chat delivery of a durable message | The message id | Notice |
| `action` | A committed prepared action's terminal attention for its proposer | The action id | Concrete |
| `task_assignment` | A direct task assignment to this Agent | The assignment identity | Concrete |
| `reminder` | One reminder fire | The fire id | Concrete |
| `trigger` | One Trigger fire | The fire id | Concrete |
| `onboarding` | Cove's one-shot bootstrap instruction | Its own bootstrap identity | Concrete |

Only ordinary Chat work is backed by a `chat_messages` row; the rest exist solely
here, because a fact only an Agent needs is never written to a transcript humans read
(ADR 0026). A human learns each of those facts from a representation on the content it
explains — the task chip, the fire mark, the session mark — described in
[automation-provenance.md](automation-provenance.md) and
[sessions.md](sessions.md).

One lifecycle covers every kind: `queued` when planned, `accepted` when the Computer
acknowledges the run carrying it, `served` when its body reaches the model — a pull for
notice-lane work, acceptance itself for concrete work, whose body is already in the run's
prompt — and `seen` when the turn settles with the item proven model-visible.
Retirement keeps the row as ledger evidence rather than deleting it. An item that cannot reach `seen` is re-offered on every wake, so
a new kind is only correct once it settles like the others, and deleting the automation
behind a queued fire retires that item rather than leaving it to replay.

## Cause inference (ADR 0026)

An Agent that answers a fire attributes the answer itself with `grotto message send
--cause <fireId>`, which records `attribution = 'explicit'` and always wins. When a send
carries no `--cause`, the Server infers the cause under exactly one rule, and writes
nothing otherwise:

1. the sending run's served item set contains exactly one item and that item is a
   reminder or Trigger fire — a fire the run was woken with is served the moment the
   Computer accepts that run, so the rule holds without any pull; and
2. the send's target Chat is that fire's anchor Chat — a Thread target resolves to its
   parent Chat first.

Then `message_causes` records that fire with `attribution = 'inferred'`. A run offered a
fire alongside anything else — another fire, a Chat message, an attention — infers
nothing, because the Agent had more than one reason to speak. Inference is deliberately
narrow: an unattributed answer is an ordinary message, which is a better outcome than a
mark that names the wrong cause.

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
  adds one `task_assignment` item to only the assignee's inbox. It is `mentioned=true` so it stays
  actionable through a mute, and renders in Agent inbox envelopes the way a committed action's
  attention does. The human's representation of that fact is the task chip on the message.
- A successfully committed prepared action creates one terminal attention for only its proposer,
  carrying the originating Chat, action identity, created Agent identity, and executed result.
- After planning, ordinary Chat work gives an idle Agent a notice turn and a busy Agent receives the
  same notice in its live turn. Concrete work — a committed action attention, an automation fire, a
  task assignment — is the typed exception: an idle recipient receives the item's own envelope as
  the prompt of a distinct turn; a busy recipient receives only the content-free notice at a safe
  boundary, then the still-queued item in the next turn. One drain never mixes the lanes, and a
  concrete drain never mixes kinds, so each concrete item earns its own dedicated wake. An automation
  fire's envelope prints `msg=-`, since a fire has no Chat message to address; its id rides the
  envelope's own `fire=` and `--cause` lines. Humans keep their own read/unread system; the inbox is
  agent-only state.

## Visibility ledger (I3)

Transport debt is the exact queued set in `agent_inbox`; delivery never advances a scalar
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
bootstrap instruction, a committed action's terminal attention, reminder and Trigger fires, and task
assignments use that lane, settle against their own stable identities, and never enter Chat message
resolution or Chat cursor accounting. Each of those exists nowhere but its inbox row, so its
envelope rides the wake instead of waiting behind a pull the Agent may never make. The
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
through to Server when that local cache is empty or holds a pending Trigger or
Reminder fire, whose body only the Server serves. A single invocation
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
