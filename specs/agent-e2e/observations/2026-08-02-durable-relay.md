---
read_when:
  - reviewing the durable-relay Agent E2E scenario
  - changing fresh-session recovery, Thread handoff, or Agent artifacts
---

# Durable relay — 2026-08-02

The matched business interaction asked one Agent to recommend a 14-day or
30-day free trial for a self-serve B2B SaaS, support the decision with public
sources, and leave a durable brief for a successor. A second Agent started a
fresh session before the human asked it to continue from the existing Thread
without restating the assignment. Both products used GPT-5.6 Terra with medium
reasoning.

## Raft baseline

Raft channel: `#durable-relay-0802`.

Agent A prompt:

> @Cindy Own this as a task. We need to decide whether a self-serve B2B SaaS
> should default to a 14-day or 30-day free trial. Research current public
> evidence, write a concise decision brief with an explicit recommendation, at
> least three cited source links, key risks, and a two-week validation plan.
> Save the brief as a durable workspace artifact and share it in this task
> thread so another teammate can continue without asking me for the assignment.
> Do not delegate this first pass.

Cindy claimed immediately and completed in 116 seconds. She recommended a
14-day default with explicit 30-day exceptions, cited four sources, described
the evidence limits, proposed a controlled experiment, and saved
`notes/free-trial-length-decision-2026-08-02.md`.

Bob's session was reset through Raft's Agent profile before the handoff:

> @Bob Take over from the durable work already in this thread. Do not ask me to
> restate the assignment. Independently verify the cited evidence, amend any
> weak or overstated claim, and deliver the next useful continuation: a
> decision-ready rollout checklist with go/no-go thresholds. Cite the evidence
> you relied on.

Bob completed in 131 seconds. He recovered the decision and citations, dropped
an unavailable source, narrowed “14 days wins” to a product-specific
hypothesis, added explicit experiment gates, and saved
`notes/free-trial-rollout-checklist-2026-08-02.md`.

## Grotto before implementation

Grotto channel: `#durable-relay-0802`, Chat
`cht_u97wG9-8rQWObLJ_`, base `ebe9d8a4f`.

The materially matched Wren prompt additionally named the supported artifact
contract:
`workbench/free-trial-length-decision-2026-08-02.html`. Wren claimed, posted
progress, delivered an inline recommendation with four public links, shared a
clickable artifact, and moved the task to review in 235 seconds. The artifact
opened in the App with the exact workspace file selected.

Otto was configured to GPT-5.6 Terra and started with a fresh session before
the matched handoff. He recovered the Thread and citations, narrowed the
competitor examples to evidence of heterogeneous practice rather than causal
superiority, and produced explicit instrumentation, non-inferiority,
guardrail, staged-rollout, and rollback gates in 249 seconds.

The task was still owned by Wren when Otto first attempted to claim it. Otto
reported the lock instead of working around it; Wren unclaimed; Otto claimed
and continued without another human message. Otto also reported that Wren's
workspace bytes were not directly readable from his Agent workspace. Wren
then supplied the durable `grotto://workspace/` link, byte count, and SHA-256.
This is the intended Agent-owned workspace boundary. Canonical Thread content
and artifact identity carried the collaboration handoff.

The first executable reproduction on base `ebe9d8a4f` exposed a separate
product failure before Agent A could start. The App had already created
`cht_thr_J0OG4b2vDKwOgGKZ` for the human's reply. When Agent A converted the
anchor to a task, the Agent task path attempted to insert the same deterministic
Thread again. PostgreSQL rejected every retry with a duplicate primary key, and
the Agent reported `SERVER_5XX`.

The fix routes Agent task Thread creation through the existing idempotent hosted
Thread record boundary. Deterministic Server coverage now creates a Thread
reply first, marks that context served, converts the anchor to a task through
the Agent API, and proves the same Thread survives.

## Final live lane

The final economical lane used one directly mentioned task and three supplied
public evidence pages. Agent A completed every first-owner gate:

- recommended a 14-day trial and stated two risks plus a two-week plan;
- included all three exact source URLs and honestly noted that the supplied
  Paddle page returned 404;
- generated relay token `DR-kGMUmLmiRFhPJxCJcKHqUgzR`;
- saved and rendered
  `workbench/durable-relay-20260802200448.html`.

The lane then reached its 720-second bound waiting for an App control named
`Edit participants`; that control was not present in the channel header, so the
test never sent Agent B's handoff prompt. The disposable Agents and
`#relay-02200448` were removed exactly. This sample is timing-quarantined and
non-gating. It does not replace the matched manual Grotto handoff above, where
fresh-session Otto recovered the Thread and delivered the continuation.

The committed fixture no longer depends on a mid-test participant edit. Both
disposable Agents are channel participants from setup, while the initial
canonical task directly mentions Agent A; Agent B is reset before the later
direct handoff. This corrected fixture was not rerun after the final-lane cap.

## Stable gate

The executable scenario target avoids source-quality assertions that one live
model sample cannot stabilize. It checks:

- Agent A creates an unpredictable relay token, source-backed inline brief, and
  clickable HTML artifact in one Thread;
- the artifact exists with the exact token in Agent A's workspace;
- Agent B starts a fresh session;
- the human does not repeat the original assignment or token;
- Agent B recovers the exact token, artifact path, and at least one source URL,
  then returns an evidence amendment, go/no-go gates, and next action.

Screenshots are recorded under
`.context/agent-e2e/durable-relay-2026-08-02/`:

- `raft-agent-a-brief.png`
- `raft-agent-b-continuation.png`
- `grotto-before-agent-a-brief.png`
- `grotto-before-agent-a-artifact.png`
- `grotto-before-agent-b-continuation.png`
- `grotto-final-lane-agent-a-brief.png`
