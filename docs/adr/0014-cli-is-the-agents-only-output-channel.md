---
summary: Decision to make the grotto CLI the agent's only output channel, with floating turns and inbox delivery replacing reply-based dispatch.
read_when: changing agent turn scheduling, delivery, cursors, notices, or the agent tool surface; changing chat timeline projection or agent status UI; reading the history behind the memory/wiki/cron retirements
---

# 14. The CLI is the agent's only output channel

Date: 2026-07-22

## Status

Accepted. Implements decisions D1/D5/I1–I4 of the Raft-alignment program
contract ([specs/raft-alignment/README.md](../../specs/raft-alignment/README.md));
supersedes the reply-based turn model of ADR 0007/0011 (the global-session
core of ADR 0011 survives).

## Decision

Agents speak only by running `grotto message send`. The engine exposes zero
tools except the uniform `web_fetch` host tool; every other capability is a
CLI on PATH. Consequences adopted together as one landing:

- **No final replies.** Text a model emits outside a `grotto` command is
  delivered to no one. `NO_REPLY`, outcome notes, per-message evaluation
  dispatch, and per-turn chat response rows are gone.
- **Floating turns.** A turn anchors to the agent's global session, never a
  chat. Ordinary idle wakes and busy steering carry content-free notice
  metadata; Computer-local bodies enter context only when the Agent pulls.
  A pending notice is the first prompt of a fresh session; bare `Start.` is
  used only when no delivery is pending. Startup never races a second input.
- **Inbox delivery.** A delivery planner listens on `message.created` and
  queues per attention rules: joined channels, followed threads, and DMs
  deliver ordinarily; a channel mute suppresses the channel and its threads;
  personal @mentions pierce as single messages that do not re-follow.
- **Two-cursor ledger.** Per (session, target): `delivered` is transport
  state (muted targets never advance it); `seen` is the sole model-seen
  authority for freshness holds and catch-up, advanced only on proof — exact
  pulled bodies attached to the turn, typed concrete system attention, and
  hold catch-up rows. Notices and wakes advance nothing.
- **Content-free notices.** Idle and busy agents see only batched target rows —
  counts, ids, latest sender — never bodies.
- **Chat level shows humans human things.** The timeline is durable messages
  plus the ephemeral composition stream (a provisional bubble streamed from
  an in-flight send, committed by the `message.created` compositionId echo,
  retracted on a freshness hold). Execution evidence lives at agent level:
  status dot, activity feed, prompt and file-change trace.

The same landing retires the systems the CLI-only model replaces: the memory
pipeline (extraction, dreaming, core-memory injection), the Wiki, the cron
product, SOUL injection (the agent description is the personality surface),
first-party plugin engine tools, and the first task tracker (chat-first tasks
return with the tasks workstream). ADR 0017 later replaced the retired plugin
model with standard MCP connections and Runtime-relayed exact tool grants.

## Why

One decision carries the design: with the CLI as the only output channel,
silence is the default and speaking is an act, the freshness gate lives on
the send path exactly once, one prompt works on every runtime because it
needs only a shell, and every capability arrives as a CLI verb instead of a
tool-schema change. The full rationale and the Raft evidence audit live in
the program contract; the wire contract is
[specs/grotto-cli.md](../../specs/grotto-cli.md).
