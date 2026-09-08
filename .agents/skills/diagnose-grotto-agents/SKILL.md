---
name: diagnose-grotto-agents
description: Diagnose and fix Grotto Agent latency, slow responses, tool loops, wrong context, inbox delivery, missing or duplicate messages, and Computer execution. Use for Agent performance and behavior investigations, including recordings and production incidents. Checks Axiom and creates a Luna-max Raft research partner when the mechanism benefits from comparison.
---

# Diagnose Grotto Agents

Trace the distributed execution path before attributing symptoms to prompt quality or model speed. Preserve the
Raft-derived product contract: one Agent owns one continuous global execution session spanning all
Chats. Cross-chat knowledge is expected; confusing the current request or target is not.

Use the repository's `diagnosing-bugs` skill too when it is available. This skill supplies the
Grotto/Raft domain model and research-partner protocol; `diagnosing-bugs` supplies the general
red-green diagnosis loop.

## Start With The Model

Read [references/grotto-agent-model.md](references/grotto-agent-model.md) completely. Run the
repository's docs-list command, read the reference's core set, then add documents whose `read_when`
hints match the observed subsystem. Include the relevant portion of the Raft-alignment epic; do not
load every workstream artifact by default.

Confirm the checkout and environment without printing secrets. Follow repository setup and dev-port
conventions. Prefer deterministic tests and seeded fixtures over noisy hosted or local Chats.

## Start With Existing Telemetry

For runtime incidents and performance investigations, use the `axiom-ops` skill and query Axiom
before declaring timing or failure evidence missing. Read `docs/internals/observability.md` for
the current trace and privacy contract. Discover dataset schemas; bound queries by incident time,
environment, and Agent/run identity. Follow dispatch → Computer turn → MCP spans, then join local
journals and native session evidence for detail inside the turn. Check failures before journal
creation too. If Axiom is unavailable, say so and continue with local evidence; an unqueried source
is not missing instrumentation. Offline deterministic bugs need no production query.

Separate dispatch delay, native preparation, tools, first/last confirmed send, and settlement.
An acknowledgment is not a completed answer, and time between tool calls is not proven inference
time. Match model, reasoning effort, session state, and available service-tier information before
comparing runs. Keep raw content out of telemetry. Add instrumentation only for a named missing
discriminator; distinguish temporary diagnostics from deliberate permanent observability changes.

## Create A Raft Research Partner When Useful

Read [references/raft-research.md](references/raft-research.md) completely. Early in the
investigation, spawn one read-only subagent when session lifecycle, delivery, tool discovery,
context handling, or runtime architecture could explain the symptom. This workflow explicitly
authorizes that delegation without a separate user request. Use `gpt-5.6-luna` at `max` reasoning
with a scoped prompt and no inherited history when the tool supports those settings. If unavailable,
report the fallback model rather than silently claiming Luna-max. Skip the partner for a proven
local defect whose mechanism has no meaningful Raft comparison. Keep it available for the
whole diagnosis; it is a conversation partner and adversarial validator, not a one-shot summarizer.
Timebox its first pass to a compact checkpoint; deepen only the sources implicated by local
evidence.

Give it the raw symptom and ask it to:

1. Research primary public Raft sources: `raft.build`, `docs.raft.build`, and Raft's blog.
2. Read the repository's Raft-alignment specs.
3. Inspect the local Raft Computer and daemon source plus the installed implementation read-only.
4. Return a source-backed behavioral model, parity and deliberate divergences, three to five
   falsifiable questions, and a challenge to the leading hypothesis.

Do not give the partner a suspected answer as fact. Do not let it edit Grotto or Raft repositories
or inspect credentials. If local Raft code or the public network is unavailable, record that
evidence gap and continue with repository sources.

## Establish A Deterministic Red Loop

Before ranking causes for a fix, reduce the report to a concrete observable:

- exact Agent and target topology;
- preceding work in other Chats;
- current structured envelope, notice, or wake;
- expected target and response behavior;
- actual target and response behavior;
- repeatable command or focused test with a short cycle.

Trace identities through the full path: hosted send, canonical pending delivery, Computer inbox,
delivered/seen ledgers, session input construction, task or thread routing, prompt projection, and
runtime execution. Inspect actual values at boundaries; do not infer them from UI labels.

Use the evidence already collected before adding temporary instrumentation. Give temporary probes
a unique prefix and remove them before handoff. Never log secrets or unrelated conversation bodies.

If the task is read-only, hypothetical, or lacks the state needed for a red run, produce an
**evidence-only checkpoint** instead: state the leading mechanisms and confidence, identify the
single missing discriminator, and specify the red-capable test to run once mutation or fixtures are
available. Do not present a provisional mechanism as the exact cause.

## Form And Challenge Hypotheses

Write three to five ranked, falsifiable hypotheses. Prefer mechanisms that explain every observed
fact. Explicitly test whether:

- the concrete request was delivered with the exact target;
- the identity became model-visible exactly once;
- a content-free notice reintroduced already consumed work;
- a stale notice had already entered the live runtime before persisted state was reconciled;
- a cursor or pending target advanced too early or too late;
- batching collapsed multiple targets into one active Chat;
- stale task metadata was presented as the current request;
- the model merely chose poorly despite correct input.

Send the evidence table and hypotheses to the Raft partner. Ask it which hypothesis conflicts with
Raft's implementation or contract, what observation would distinguish the top two, and whether the
proposed test oracle is strong enough. Update the ranking from evidence, not authority.

## Regress, Fix, Validate

For development prompt iterations, reset the test Agent's session before behavioral verification,
using the session-only reset that preserves workspace memory and Chat history. Confirm the fresh
native session received the revised instructions before judging model behavior. A new Channel alone
does not create a new session. Reserve the managed Agent prompt-version bump for release; do not bump
it for each local edit. Capture any failing session evidence before resetting it.

Add a focused regression at the smallest boundary that reproduces the actual mechanism before
changing implementation. For context-misassociation bugs, the oracle must keep the global session:
prior work in Chat A, then a concrete request in Chat B, with Chat B delivered once and grounded as
the current request.

Separate proof into two layers:

1. A deterministic structural test records every resumed Harness input and proves target, identity,
   ordering, visibility, and notice accounting.
2. An optional behavioral eval proves the model answers an ordinary request appropriately once its
   input is correct.

The structural test is the delivery/state-machine oracle. Do not make model wording its primary
assertion.

Implement the smallest root-cause fix. Do not create per-Chat sessions, replay full Chat histories,
or hide unrelated context unless the product contract is intentionally changing. Delete temporary
instrumentation and obsolete paths.

Then send the proposed behavior or diff to the Raft partner. Ask it to validate parity, identify any
intentional divergence that must be documented, and name one remaining failure mode. Resolve
material objections with local proof.

Run the focused regression, the owning package's test/build lane, lint and type checks required by
the repository, and the repository's pre-ship review skill. Prompt changes additionally require the
guarded prompt contract suite, operator-visible snapshot review, and behavioral evals specified by
the repository.

## Report

For a completed fix, lead with the exact cause. For a diagnosis-only checkpoint, lead with the
highest-confidence mechanism and missing discriminator. Explain why the global session remains
correct, which delivery or grounding invariant failed or may have failed, the smallest fix or next
test, deterministic proof, Raft validation, and any unverified gap. Distinguish direct evidence,
source-backed contract, and inference. Name the Axiom window and trace/run ids, what it established,
and remaining gaps. Describe Raft comparisons as implementation evidence unless matched timing was
actually measured. When Grok Bot comparison is relevant, use current primary documentation and
bounded installed-app inspection; keep its undocumented model loop and latency claims explicit gaps.
