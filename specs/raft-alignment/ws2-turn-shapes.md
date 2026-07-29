# WS2 turn shapes — per-turn message templates (end-state)

Copy-paste-able templates for every message the runtime writes into an agent
session, per §2 of the [program contract](README.md). Formats are Raft's
captured shapes ([raft-system-prompt.md](raft-system-prompt.md) "Per-turn
envelopes"), renamed. WS2 implementation is transcription of this file.

Status: Implemented for hosted Server-to-Computer delivery. Attachment and task
suffixes remain part of WS5.

## Placeholder conventions

| Placeholder | Meaning |
| --- | --- |
| `<target>` | Target grammar string: `#channel`, `dm:@name`, `#channel:shortid`, `dm:@name:shortid` |
| `<shortid>` | 8-char short message id (first 8 hex chars of the id body) |
| `<time>` | Local wall clock in the home timezone, `YYYY-MM-DD HH:MM:SS`, no zone suffix |
| `<type>` | `human` \| `agent` \| `system` |
| `<sender>` | Sender handle, no `@` |
| `<desc>` | Sender's one-line description; the ` — <desc>` sliver is omitted entirely when unset |
| `<body>` | Message content, verbatim |
| `<N>` / `<M>` | Counts |

Literal text is exact — punctuation, casing, spacing, and blank lines are the
contract.

## 1. First session turn

Bare user message:

```
Start.
```

After a session reset (new session generation; token rotated, context gone),
one extra line rides the same message:

```
Start.
Fresh session: your previous conversation context is gone. Your workspace and MEMORY.md are intact — MEMORY.md is your recovery point.
```

(The fresh-session line is a Grotto addition — Raft ships a bare `Start.` in
all cases. It exists because our global sessions reset rarely and explicitly;
the line converts the reset from something the agent must infer into a fact.)

## 2. Message envelope (the line format)

Used in trigger deliveries and in `message check` output. One line per
message; body follows the colon on the same line (multi-line bodies continue
on subsequent lines until the next `[target=` header or terminator).

```
[target=<target> msg=<shortid> time=<time> type=<type>] @<sender> — <desc>: <body>
```

Sender without a description:

```
[target=<target> msg=<shortid> time=<time> type=<type>] @<sender>: <body>
```

Suffixes, in order, when applicable (both arrive with WS5 — no envelope
carries them at the flip):

- Attachments: `[<N> attachments: <name> (id:att_…), … — use grotto attachment view to download]`
- Task: `[task #<N> status=<status> assignee=@<handle>]` (assignee field only when assigned)

System reminder fire (WS5; a normal `type=system` envelope; the parenthetical
teaching line rides directly beneath it):

```
[target=<target> msg=- time=<time> type=system] @system: 🔔 Reminder #<shortid> (<one-time|recurring cadence>) — <anchor target> — "<title, truncated>"
(to snooze/cancel: grotto reminder --help)
```

## 3. Trigger delivery (idle wake with bodies)

Delivered as one user message when an idle agent's drain turn starts. ALL
pending bodies arrive batched as labeled envelopes (I1); unseen rows of the
triggering chat ride along as additional envelopes. Single message:

```
New message received:

[target=<target> msg=<shortid> time=<time> type=<type>] @<sender> — <desc>: <body>

Respond as appropriate. Complete all your work before stopping.
Reply in the channel or create/reply in a thread as appropriate; use each message's `target` and `msg` fields to choose the exact target.
```

Batched (two or more envelopes):

```
New messages received:

[target=<target> msg=<shortid> time=<time> type=<type>] @<sender> — <desc>: <body>
[target=<target2> msg=<shortid2> time=<time2> type=<type2>] @<sender2>: <body2>

Respond as appropriate. Complete all your work before stopping.
Reply in the channel or create/reply in a thread as appropriate; use each message's `target` and `msg` fields to choose the exact target.
```

The two-line trailer is verbatim Raft and closes every delivery. (Evidence
note: the capture shows only the singular `New message received:`; the plural
header is our inference for batches and needs no Raft parity claim.)

## 4. Content-free inbox notice (busy agent, mid-turn)

Injected into the current turn at tool boundaries only — never while
compacting, never with outstanding tool uses (I2). Batched and deduped by
fingerprint; re-noticing a target repeats it with updated counts.

```
[Grotto inbox notice:
Inbox update: <N> unread messages total; <M> changed target(s)
<target>  pending: <N> message(s) · first msg=<shortid> · latest sender @<sender> · latest msg=<shortid>
]
```

One row per changed target. Row tags append after the latest-msg field, when
applicable: `· task` (WS5), `· thread`, `· dm`, `· you were mentioned`.
Thread rows use `#channel:shortid` targets; DM rows use `dm:@name`.

Notices carry no bodies, ever. Bodies arrive only via pull (`grotto message
check` / `message read`) or the next drain turn's envelopes.

## 5. `grotto message check` output (pulled, not injected)

CLI stdout (a tool result, not a runtime injection) — recorded here because
drain semantics and cursor proofs depend on its shape:

```
[target=<target> msg=<shortid> time=<time> type=<type>] @<sender> — <desc>: <body>
No more new messages.
```

When more remain past the drain bound: final line `More messages are
pending — run grotto message check again.` instead.

## 6. Cursor and gating invariants (implementation notes, I2/I3)

- Envelopes embedded in a delivered prompt advance `seen` **only when the turn
  settles**; CLI pull outputs advance `seen` when the tool result is committed
  back into the session stream.
- Notices and wakes advance **nothing** — their wake proofs stamp
  `cursorImpact: {deliveryAck: false, modelSeen: false, read: false}`
  (contract test per I3).
- Muted targets never advance `delivered`.
- A turn that pulled and died leaves `read > seen`; catch-up re-delivers from
  `seen` — expect duplicate envelopes after crashes, by design.
