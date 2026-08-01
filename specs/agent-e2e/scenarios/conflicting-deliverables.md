---
summary: Live multi-Agent behavior contract for reconciling overlapping deliverables without silently merging contradictory evidence.
read_when:
  - changing Agent task delegation, ownership, or task-Thread delivery
  - changing multi-Agent coordination behavior or live Agent E2E coverage
---

# Conflicting deliverables

When independently owned lanes produce overlapping work with contradictory
evidence, the coordinator must preserve the disagreement as decision context:

1. Assign exactly one owner to each lane and keep the lane tasks distinct.
2. Require each lane to return its claim with the source or evidence that
   supports it.
3. Wait for the relevant lane outputs before synthesizing the parent Chat.
4. Reconcile ownership and evidence explicitly; do not silently combine,
   average, or replace contradictory claims.
5. Publish one coherent parent result. If the available evidence does not
   resolve the conflict, state the unresolved conflict and hand the decision
   to the human instead of inventing a winner.

The live Agent E2E scenario assigns the same launch-date deliverable to two
real Agents with equally authoritative, contradictory source claims. It drives
the request through the App composer and observes task assignees, task Threads,
worker-authored evidence, and the final parent-Chat handoff. Temporary Chats
are deleted by exact parent-Chat IDs; the cleanup helper adds their
deterministic task Threads and rejects a direct task-Thread deletion that would
leave a hosted task row orphaned.
