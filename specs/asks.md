---
summary: Asks — Agent-authored Messages that request one human's decision and stay in that human's Inbox until they are answered.
read_when:
  - adding or changing Asks, their settlement, Inbox rows, Thread markers, or the `grotto ask` command
  - changing typed Message bodies or record-backed Message rendering
  - deciding whether a human decision belongs in an Ask, an Agent creation proposal, or a Task
---

# Asks

An Ask is an Agent-authored Message that asks one human for a decision and stays visible in that
human's Inbox until someone answers. It is the first Grotto record that names a specific human as
the one who needs to act.

An Ask changes nothing on its own. It carries a question, a recommended step, and an addressee; the
answer is an ordinary Message, and the asking Agent decides what the answer means.

## Product contract

- **One durable Message.** The Agent posts an ordinary Message whose immutable `content` is its
  question in its own words. The same call carries the typed body `{ kind: 'ask'; ask: Ask }`. Body
  kinds follow [ADR 0025](../docs/adr/0025-messages-carry-typed-product-bodies.md): a Server record
  projected through the one Server Message reader.
- **One human addressee.** The Agent chooses the addressee from conversation context. The addressee
  must be an active Server member with access to the Chat. A missing or ineligible addressee fails
  before any Message is created, the same truthful-launch rule Cloud Agent work uses.
- **One conversation.** A top-level Ask Message receives its child Thread immediately; an Ask posted
  inside a Thread stays there, because Threads do not nest. The Thread is where the answer happens.
- **One answer.** The first reply in the Ask's Thread from any participant other than the asking
  Agent settles the Ask. There is no second answer channel and no editable answer state.
- **No mutation.** An Ask never advances a Task, commits a proposal, or changes any other record.

## The Ask record

Server stores one `Ask` for each Ask Message. The Message owns authorship and Chat placement; the
Ask owns the request and its settlement.

```ts
type Ask = {
    id: string;
    messageId: string;
    chatId: string;
    agentId: string;
    addresseeUserId: string;
    title: string;
    summary: string;
    recommendedStep: string;
    status: 'open' | 'answered';
    answeredBy: { kind: 'user' | 'agent'; id: string } | null;
    answerMessageId: string | null;
    createdAt: string;
    answeredAt: string | null;
};
```

The relationship is one-to-one: `message_id` is unique and references the Message. Creation is one
Server transaction that writes the Message, the Ask, the Thread when the Ask is top-level, and the
durable events, idempotent by the message nonce.

## Settlement

The first Thread reply from any participant other than the asking Agent settles the Ask as
`answered` and records that author and Message. Humans and Agents alike may answer; the addressee is
who Grotto notifies, not who Grotto permits. The asking Agent uses its own judgment about the answer
and may post a new Ask when the answer does not resolve the question.

Settlement is a side effect of the ordinary Message creation paths, not a mutation of its own, so
Grotto has no answer route to authorize or replay. A reply answers the Ask nearest to it: the newest
open Ask posted earlier inside that Thread, or otherwise the Ask the Thread hangs off. A later reply
finds nothing open and changes nothing — the first answer wins, permanently.

`ask.listOpen({ serverId })` is the Server read behind the Inbox: the viewer's open Asks with the
projected Ask, its Message, the conversation the answer is addressed to — the Channel or DM, never
a Thread — and the Thread plus the anchor Message a reply hangs off. An Ask posted inside a Thread
answers on that Thread's own anchor, so the row carries it. Membership plus Chat access gate the
read, and lost access simply stops returning the row.

## Inbox row

An open Ask addressed to a human appears in that human's [Inbox](../docs/features/inbox.md) under
"Needs you" with its title, its summary, the recommended step as a button, and the Chat name.

Pressing the step sends a real Message authored by that human into the Ask's Thread whose content is
exactly the step text. That Message settles the Ask and reaches the Agent through ordinary Thread
delivery. Opening the row opens the Thread.

## Chat presentation

An Ask reads as an ordinary Message. Grotto App renders the recessed Thread surface beneath it with
a compact Ask marker in the task-chip grammar: the Ask glyph, the addressee's avatar and name, and a
trailing status — an open disc, or `Answered by <name>` — plus the ordinary reply count when the Ask
is top-level. Inside a Thread the marker renders on the reply without a count. Only the trailing
status carries lifecycle color. Older clients and unknown body kinds render the Message `content`
and the ordinary Thread preview.

## Agent reading

An Ask Message reads back to an Agent as an ordinary Message with `body_kind: 'ask'` and the Ask
facts an actor needs beside it — its id, status, addressee handle, title, and recommended step.
Every surface that prints a Message appends `[ask status=open|answered to=@handle]` after the task
suffix, the same way Tasks ride their `[task #N status=…]`
([Grotto CLI](grotto-cli.md#4-envelopes-and-message-lines)).

## Agent CLI

The Agent CLI is an Agent's only output channel
([ADR 0014](../docs/adr/0014-cli-is-the-agents-only-output-channel.md)):

```text
grotto ask --target <target> --to @<handle> --title <text> --summary <text> --step <text>
```

The question text arrives on stdin and becomes the Message content.

## Events and delivery

Lifecycle changes emit a durable `ask.updated` event carrying the Message and Ask identities.
Creation emits it beside the Ask Message's `message.created`; settlement emits it beside the reply's.
Events notify; refetching the Message recovers. This is the same realtime pattern Tasks and Cloud Agent
work use.

The answer needs no new attention type. It is an ordinary Thread reply, and the asking Agent follows
the Thread it anchored, so it wakes through existing [Agent inbox](inbox.md) delivery.

## Relationship to other Message bodies

An Agent creation proposal stays its own body kind because a human commits a mutation there. Cloud
Agent launch approval is Server policy rather than a card: when a Server wants it, the Agent posts an
Ask and proceeds on the answer ([Cloud Agents](cloud-agents.md)). Human mentions remain visual-only
([Rich References](mentions.md)); the Ask is the record that says a specific human must act, so
future notification channels such as push and SMS attach to open Asks.

How and when an Agent asks — one question at a time, a staged artifact to inspect, a hard stop
before an irreversible act — is Manual and recipe material in Raft's decision-recipe style. This
spec owns the record and its surfaces.

## Ownership

| Layer | Owns |
| --- | --- |
| Grotto Server | The Ask record, addressee authorization, settlement, durable events, and the Inbox projection |
| Grotto App | Inbox rows, the recommended-step button, and the Thread-surface Ask marker |
| Grotto Computer | The `grotto ask` command and its Agent-scoped Server call |

## Intentionally missing

- No answer options, defaults, expiry, or escalation.
- No role addressees, multiple addressees, or Agent-addressed Asks.
- No separate answer channel; the Thread reply is the answer.
- No per-Ask notification channels in v1.
- No reminders on Asks; an Agent that wants a follow-up sets an ordinary reminder.

## Implementation sequence

1. **Landed.** The `ask` body kind, the Server `Ask` record, and its projection through the one
   Server Message reader. Asks introduced `chat_messages.body_kind` and the `text | ask` union
   ahead of Cloud Agent work rather than after it; the Agent-creation proposal rename folds into
   the same union later ([Cloud Agents](cloud-agents.md)).
2. **Landed.** The `grotto ask` command, addressee validation, the single creation transaction,
   settlement inside the ordinary Message creation paths, `ask.updated`, and `ask.listOpen`.
3. **Landed.** The Inbox "Needs you" row and the recommended-step button that posts the human's
   Message.
4. **Landed in web.** The Thread-surface Ask marker in Grotto App, with deterministic Server, API,
   Computer, and App coverage of creation, settlement, ineligible-addressee failure, the Agent line
   format, and the browser Inbox flow. Still open: the iOS marker and its coverage.
