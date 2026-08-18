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

## 1. First session turn without pending delivery

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

When a delivery is already pending, its notice or typed attention is the first
prompt instead. After a reset, the fresh-session recovery line precedes that
delivery in the same prompt. Computer must not start with `Start.` and race a
second mid-turn input into the Agent engine.

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

## 3. Concrete system attention and crash replay

Ordinary Chat messages never use this shape. A concrete body is projected only
for typed non-Chat system attention or replay of identities already proven
visible in an unsettled turn. Single envelope:

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

The trailer closes concrete delivery. It is not an ordinary wake contract.

## 4. Content-free inbox notice (idle wake or busy Agent)

Starts an idle turn or is injected into the current turn at safe boundaries.
It is batched and deduped by exact offered identities; a changed pending set
repeats the current target counts. Grotto's Harness boundary is a completed
tool result; a notice arriving after the last such boundary remains durable for
the next turn.

```
[Grotto inbox notice:
Inbox update: <N> unread <message/messages> total; <M> changed <target/targets>
<target>  pending: <N> <message/messages> · first msg=<shortid> · latest sender @<sender> · latest msg=<shortid>
]
```

One row per changed target. Row tags append after the latest-msg field, when
applicable: `· task` (WS5), `· thread`, `· dm`, `· you were mentioned`.
Thread rows use `#channel:shortid` targets; DM rows use `dm:@name`.

Notices carry no bodies, ever. Ordinary Chat bodies arrive only via pull
(`grotto message check` / `message read`).

## 5. `grotto message check` output (pulled, not injected)

CLI stdout (a tool result, not a runtime injection) — recorded here because
drain semantics and cursor proofs depend on its shape:

```
[target=<target> msg=<shortid> time=<time> type=<type>] @<sender> — <desc>: <body>
No more new messages.
```

One invocation drains successive pages up to the Raft-aligned 50-round cap.
When more remain after that cap: final line `More messages are pending — run
grotto message check again.` instead.

## 6. Cursor and gating invariants (implementation notes, I2/I3)

- Local and Server pulls advance `served` immediately so a pull-then-send does
  not spuriously hold. Their exact identities are attached to the active turn;
  `seen` advances only when that turn settles.
- Concrete typed attention and freshness-hold rows also advance `seen` only
  through their owning settlement or visibility proof.
- Notices and wakes advance **nothing** — their wake proofs stamp
  `cursorImpact: {deliveryAck: false, modelSeen: false, read: false}`
  (contract test per I3).
- Muted targets never advance `delivered`.
- A turn that pulled and died leaves `served > seen`; catch-up re-delivers from
  `seen` — expect duplicate envelopes after crashes, by design.
