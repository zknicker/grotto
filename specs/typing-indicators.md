---
summary: Typing indicators — human composition and Agent Chat engagement projected through one Chat-scoped ephemeral UI contract.
read_when:
  - changing human typing signals or composer behavior
  - changing Agent inbox visibility, Chat engagement, or turn settlement
  - changing Chat-scoped realtime subscriptions or typing presentation
---

# Typing Indicators

The typing indicator is an ephemeral social cue near the Chat composer. Humans and Agents share one
presentation but have different authoritative facts:

- A human is typing while actively editing a non-empty draft in that Chat.
- An Agent is presented as typing while it has an active turn that has accepted pending inbox work
  originating in that Chat.

For Agents, `is typing…` deliberately means **Agent Chat engagement**, not literal response-token
generation. The Agent may still be reading or using tools, may engage several Chats in one global
turn, and may ultimately send no reply.

## Agent Chat engagement

For Agent `A`, Chat `C`, and active run `R`, engagement is true when:

1. `agent_delivery.active_run_id = R` for `A`;
2. that run was accepted by its assigned Computer;
3. at least one `agent_pending_work` row for `A` and `C` has `run_id = R`; and
4. the row's source is not onboarding.

This uses run-attached pending work, not `served` cursors. `served` has no run identity and may
legitimately survive a failed turn. Notice-only delivery does not engage a Chat because the model
has not accepted its concrete work.

One pull may attach rows from several Chats, so one Agent may appear as typing in all of them until
the turn ends. That is expected.

The Server reads the engaged Chat set before settlement, stop, reset, recovery, requeue, or any
other terminal mutation removes the underlying rows. It emits `inactive` for every engaged Chat.
Computer disconnect clears engagement immediately even if the durable active-run record has not yet
been recovered. A resumed run may restore engagement from a fresh snapshot.

## Human composition

The composer publishes `active` on the first non-empty edit and refreshes at most every two seconds
while editing continues. It publishes `inactive` on send, empty draft, Chat navigation, composer
teardown, or membership loss.

Receivers expire a human typing source after five seconds without refresh. Agent engagement has no
inactivity TTL while its Computer and turn remain healthy.

Each composer owns a stable `typingId`. Multiple tabs or composer instances from one human remain
independent; the UI aggregates them by actor so one tab cannot clear another tab's active edit.

## Realtime contract

Typing reuses the App's one authenticated tRPC WebSocket. It does not open a socket per Chat.

```ts
type ChatTypingEvent = {
  serverId: string
  chatId: string
  typingId: string
  actor:
    | { kind: "human"; userId: string }
    | { kind: "agent"; agentId: string }
  state: "active" | "inactive"
  emittedAt: string
}
```

`chat.publishTyping` is a WebSocket-routed mutation for human sources. It accepts no draft text and
requires current Chat write access. Agent sources are Server-authored and cannot be published by a
human client.

`chat.onTyping({serverId, chatId})` is Chat-access checked. On subscribe it establishes the live
listener, emits the current Agent-engagement snapshot, then yields later events without a
snapshot/event race. Human sources recover through their next bounded refresh rather than durable
replay.

Typing events are never persisted, never enter React Query, and never invalidate durable Chat
queries. One focused composer hook owns publishing. One focused Chat hook owns the subscription,
human expiry timers, actor aggregation, and component-local state.

## Presentation

The indicator renders immediately above or beside the composer, never as a provisional transcript
bubble. It uses participant names:

- `Cove is typing…`
- `Zach is typing…`
- `Cove and Zach are typing…`
- `Cove, Zach, and 2 others are typing…`

Do not show the current human to themselves. Clear the Agent indicator when its durable message
appears if settlement has already cleared engagement; do not delay message rendering to coordinate
the animation.

The obsolete hosted `sending` composition phase, streamed draft-text contract, compositionId echo,
and provisional transcript bubble are removed. The visible transition is simply:

```text
Agent is typing… -> complete committed message appears -> typing clears
```

## Failure behavior

- Socket loss clears volatile human typing locally.
- Computer loss clears Agent engagement at Server.
- Reconnect re-subscribes and snapshots current Agent engagement.
- A missed human `inactive` is bounded by the five-second expiry.
- A missed Agent terminal event is repaired by the current engagement snapshot and Computer
  availability reconciliation.

## Non-goals

- Detecting literal Agent response-token generation.
- Inferring reply intent from message reads, model text, or tool-call arguments beyond the accepted
  inbox invariant.
- Persisting typing history.
- Sending human draft contents to Server.
