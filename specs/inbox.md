---
summary: Agent inbox — delivery planning, the two-cursor ledger, drain turns, content-free notices, and the composition stream. Supersedes steering.md and addressing.md.
read_when:
  - changing which agents wake for a chat message, mute/follow semantics, or mention piercing
  - changing delivered/seen cursors, freshness catch-up, or pull acknowledgement
  - changing mid-turn notices, drain batching, or chain limits
  - changing the provisional composition bubble or agent status surfaces
---

# Agent Inbox

How messages reach agents after the flip (ADR 0014): a delivery planner
queues per attention rules, drain turns deliver batched envelopes, and the
two-cursor ledger is the only truth about what an agent has seen. Decisions
I1–I4 in [raft-alignment/README.md](raft-alignment/README.md); turn shapes in
[raft-alignment/ws2-turn-shapes.md](raft-alignment/ws2-turn-shapes.md); wire
surface in [grotto-cli.md](grotto-cli.md).

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
- After planning, an idle agent gets a drain turn; a busy agent flows into
  the notice pipeline. Humans keep their own read/unread system; the inbox
  is agent-only state.

## Two-cursor ledger (I3)

Per (session, target) in `agent_inbox_cursors`:

- `delivered` — transport state: what the inbox has queued. Muted targets
  never advance it.
- `seen` — the sole model-seen authority for freshness holds and catch-up.
  Advances only on proof: prompt-embedded envelopes when the turn settles;
  pull outputs when the tool result commits back into the session stream
  (observed as served-cursor movement between turn start and settle); hold
  catch-up rows when shown. Notices and wakes advance nothing, ever.

`served` (`agent_session_served_cursors`) remains the hold-decision assist
(ruling W1a): pulls advance it immediately so a pull-then-send never
spuriously holds. A turn that pulled and died leaves `served > seen`;
catch-up re-delivers from `seen` — duplicate envelopes after crashes are by
design. Session resets start fresh cursor horizons.

## Drain turns (I1)

Turns float on the session ([sessions.md](sessions.md)). One drain delivers
ALL pending rows — every target's `(seen, delivered]` range plus pierce rows
— as batched envelopes with Raft's verbatim trailer, bounded per drain; the
runner re-drains while a backlog remains. Fresh sessions get a bare `Start.`
turn first (plus the fresh-session line after resets). Chain budget: drains
whose envelopes are all agent-authored spend a per-session budget (16);
a human envelope resets it; at the ceiling the drain is suppressed with
cursors untouched until the next human message.

## Notices (I2)

Busy agents receive only the content-free inbox notice (turn-shapes §4):
batched target rows with counts, first/latest short ids, latest sender, and
`· thread / · dm / · you were mentioned` tags — never bodies. Rows are
deduped by fingerprint and repeat only when a target's pending state
changes. Injection rides the harness input boundary; a notice advances no
cursor.

## Pulls

`grotto message check` serves pending envelopes (advancing `served`,
clearing served pierce rows) and ends with `No more new messages.` or the
run-again teaching. `grotto inbox check` lists pending target rows without
draining. Both are agent-token surfaces (`/api/agent/events`,
`/api/agent/inbox`).

## Presentation split (I1/I4)

Chat level renders durable messages plus the ephemeral composition stream:
`agent.composition` events (volatile, never persisted or replayed) drive a
provisional bubble for an in-flight send, swapped for the durable message on
the `message.created` compositionId echo, retracted on a freshness hold, and
TTL-faded when updates stop. Everything else — status dot, activity feed,
prompt and file-change trace — is agent-level. Inbox visibility for humans
is read-only (I4): pending targets, mutes, and follows on the agent profile;
humans steer attention by asking in chat.
