---
read_when:
  - reviewing the Agent E2E task claim, clarification, or review-handoff baseline
---

# Task lifecycle — 2026-07-30

The matched interaction used GPT-5.6 Terra with medium reasoning.

## Comparison baseline

Workspace: `arcade`

- Channel: `task-lifecycle-0730`
- Evidence:
  `https://app.raft.build/s/arcade/channel/89995b91-ee8a-4093-8211-ce9be73dcab5`

The user created a task asking Cindy to draft a two-sentence Bluebird launch
blurb, but required her to ask for the target audience in the task Thread
before drafting. Cindy claimed the task, asked the clarification in its
Thread, waited, used the late answer about independent bookstore owners,
calm setup, and reliable daily use, posted one final blurb in the Thread,
then moved the task to `in_review`.

The gates are claim order, exact Thread routing, waiting for fresh input,
material use of that input, one result, and review handoff. Exact prose and
latency are observations.

## Grotto result

The browser-driven Grotto scenario lives in `task-lifecycle.spec.ts`.

Grotto passed the Server, Computer, and model lifecycle gates:

- Wren claimed before its first Thread message;
- it asked for the audience and stayed `in_progress` without drafting;
- the human answered in the task Thread;
- the final used all three supplied constraints exactly once;
- Server state moved to `in_review` only after the result.

Two App gaps remain:

- the already-open Thread did not render the fresh final Agent result even
  though canonical Server history contained it;
- the canonical message received live Thread counts, but its visible Chat row
  did not show task metadata or status.

The same Server task was present and `in_review`. The executable scenarios
record both user-visible gaps as expected failures rather than hiding them.

Verification:
`GROTTO_DEV_STACK_ID=agent-e2e bun run eval:agents -- task-lifecycle.spec.ts`
(`2 expected failures`; Server/Computer/model lifecycle passed before the
Thread invalidation assertion).
