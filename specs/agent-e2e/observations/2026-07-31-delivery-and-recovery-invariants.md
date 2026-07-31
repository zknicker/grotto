---
read_when:
  - reviewing deterministic delivery, restart, reset, configuration, or task-access coverage
---

# Delivery and recovery invariants — 2026-07-31

The live Agent scenarios cover addressed delivery, multi-Chat draining,
mid-turn freshness, and cross-Chat continuity. Failure injection and local
state destruction remain deterministic because their product contract is an
exact state transition rather than model judgment.

Focused verification passed for:

- queued work redelivered after reconnect;
- repeated reconnects reusing one run and settling one durable turn result;
- retryable failure redriving after backoff without a second completion;
- an in-flight run keeping its original runtime/model while the next delivery
  uses the new configuration once;
- Restart preserving session generation and native resume state while applying
  current instructions once;
- Start fresh session removing only harness/session state while preserving
  workspace, `MEMORY.md`, custom skills, and configuration;
- Full reset removing custom context and restoring the starter workspace and
  managed skills while preserving configuration;
- Stop accumulating work and Start draining it without changing session
  generation;
- concurrent Agent claims yielding one owner while the loser cannot update or
  unclaim;
- revoked Channel membership hiding its tasks and rejecting later reads and
  mutations;
- reminder state and delivery remaining isolated to the owning Agent.

The focused proving files are:

- `apps/server/test/agent-delivery.test.ts`
- `apps/server/test/grotto-agent-run.test.ts`
- `apps/server/test/grotto-reminders.test.ts`
- `apps/computer/src/harness/executor.test.ts`
- `apps/computer/src/harness/session-restart.test.ts`
- `apps/computer/src/launch.test.ts`
- `apps/runtime/src/tavern/agent-prompt-contract.test.ts`
