# Sessions

One agent owns one persistent harness session spanning every chat it
participates in. Chats and threads are routing and presentation surfaces —
never session boundaries. Different agents are fully isolated. Normative per
[ADR 0011](../docs/adr/0011-agents-own-one-global-session.md) as amended by
[ADR 0014](../docs/adr/0014-cli-is-the-agents-only-output-channel.md);
delivery, cursors, and notices in [inbox.md](inbox.md).

## Product boundary

- `Chat` is the durable conversation container.
- `Agent seat` is one agent's stable participation in one chat: membership,
  addressing, authorship. Seats do not own sessions.
- `AgentSession` is the agent's current global execution context: one active
  session per agent, backed by opaque engine resume state.
- `AgentTurn` is one execution inside the session, anchored to the session
  itself (floating, I1) — never to a chat. A turn's output is whatever the
  agent sends through the `grotto` CLI; there is no reply delivery.

## Attention

- One turn at a time per agent, across all chats. A seat is busy exactly
  when its agent is busy.
- An idle wake starts one notice-only turn; a busy Agent receives the same
  content-free notice in its live turn. Bodies remain Computer-local until an
  explicit pull. Chain budgets follow model-visible Agent traffic
  ([inbox.md](inbox.md)).
- A committed prepared action is the typed concrete exception: its proposer gets a
  distinct continuation with the originating Chat, created Agent identity, and executed
  result. A busy proposer receives only the notice at the safe boundary and gets the
  concrete action on the next turn. The action has no Chat cursor or visible Chat receipt.
- A fresh session with no pending delivery starts with bare `Start.`. After a
  reset, the recovery line precedes either `Start.` or the pending notice/typed
  attention that becomes the first prompt. Creating an Agent configures its
  executor but never schedules an empty bootstrap turn. Startup never races a
  second mid-turn delivery.
- Stop interrupts the live turn and persists the Agent's stopped lifecycle state. New messages and
  reminders continue to accumulate in its inbox but cannot wake it. A human Start resumes the
  current session and offers pending work again.

## Cursors

The exact-visibility ledger plus a verified contiguous seen boundary per (session, target) is
specified in [inbox.md](inbox.md). `seen` is the sole model-seen authority;
the freshness gate lives on the CLI send path exactly once
([grotto-cli.md](grotto-cli.md) §6).

## Rotation and reset

Sessions never rotate because of age or idleness. A new session starts only on:

1. **Execution runtime or model switch** — the Agent's execution configuration is Agent-scoped; a change takes
   effect on the next turn with a fresh session. Workspace, memory, and
   identity persist.
2. **Resume recovery** — if the executor reports that its stored runtime session is missing or
   replay is rejected, Computer automatically starts a fresh Agent session generation. The recovery
   is visible in activity and injected into the fresh context, directing the Agent to recover from
   Grotto history and local `MEMORY.md`/notes. If the cold start also fails, the Agent becomes
   offline with an error.
3. **Manual lifecycle action** — human-initiated, agent-scoped, in the agent profile:
   - *Restart:* restart the executor and resume the current session unchanged.
   - *Session reset:* fresh context; workspace, `MEMORY.md`, and skills persist.
   - *Full reset:* fresh context plus a wiped workspace, including `MEMORY.md`;
     Agent-authored skills and runtime-local state are also wiped. Computer then
     restores the persisted Agent kind's factory workspace and current
     factory-managed skills: minimal memory for an ordinary Agent, Cove's exact
     onboarding seed for Cove, and only `visuals` today.
   Session reset and Full reset rotate the agent token and land a system receipt
   in the agent's built-in DM. Restart does neither.

Long-horizon continuity across resets comes from engine-native compaction
and the agent's workspace MEMORY.md ([ADR 0014](../docs/adr/0014-cli-is-the-agents-only-output-channel.md)).

## Knowledge and discretion

The agent's knowledge is its own: anything learned in any chat may inform
any other. There are no trust domains. The prompt teaches discretion — what
was shared in a DM was shared with the agent, not with every room; don't
volunteer private specifics elsewhere. Hard isolation is a separate agent.
Multi-human norm: don't tell an agent what you wouldn't tell everyone who
can talk to it.

## Non-goals

- No per-chat model overrides.
- No context forking for threads; harness subagents remain an engine
  execution detail, not a session contract.
- No migration shims: cutover starts every agent on a fresh global session.
