---
summary: Server Agent contracts, Computer execution reports, turn and delivery observability, and managed Agent API routing.
read_when:
  - changing Agent CRUD, execution configuration, Computer reports, or managed Agent routes
  - reading Agent turn records or the delivery ledger
---

# Agents API

Server owns each Agent's identity, Server membership, Computer assignment, desired execution
configuration (runtime, model, and reasoning effort), lifecycle state, Chat participation, and bounded turn summaries. Computer owns the
Agent's workspace, skills, queue, session process, execution runtime, model access, and effective
execution state. Each Computer report carries the applied runtime, model, and reasoning effort;
Server keeps that effective snapshot separate from the operator's desired configuration.

The App uses the Server `agent` tRPC router for Agent reads and mutations. Server validates that
runtime and model references came from the assigned Computer's reported inventory. Changes can be
recorded while Computer is offline and are applied after reconnect; Computer reports degraded state
instead of silently substituting another runtime or model.

Each Agent projection includes `grottoAgent`: the release's `currentVersion`, the Computer-reported
`appliedVersion` and `appliedAt`, and `status` (`pending`, `current`, or `failed`). Computer carries
the applied version receipt in a separate additive snapshot frame, so an older Server can safely
ignore it and an older Computer simply leaves the new Server pending. Each snapshot replaces that
Computer's prior receipts; an omitted assigned Agent returns to pending instead of remaining
incorrectly current. Server derives **current**
only from an exact version match, so a newer Server deployment cannot claim that an older Computer
or an idle Agent has applied the release. A Computer reconnect clears the Server projection until
that connection reports its durable receipt, preventing a rollback to an older Computer from
leaving a stale Current label.

When runtime, model, or reasoning effort changes during an active turn, Server preserves that turn's
frozen configuration through settlement. It then rotates the Agent session and applies the complete
new configuration before the next turn starts.

## Turn And Delivery Observability

Two member-scoped queries expose what an Agent actually did, without reading
Computer-local execution traces. Both require Server membership and both treat a
denied or unknown Agent as `NOT_FOUND`, so probing cannot distinguish "not
yours" from "does not exist".

`agent.turns` returns that Agent's settled turns, newest first by `startedAt`,
with `limit` between 1 and 50 (default 10). Each record carries `runId`,
`startedAt`, `endedAt`, `status` (`completed` or `failed`), `failureKind` (the
compact kind that crosses the Server boundary, otherwise null), `outputProduced`,
`messageCount`, and the bounded `summary`. `outputProduced` is what makes a
silent turn readable: a completed turn with no output and no messages is
positive proof the Agent chose to stay quiet, not evidence of a lost run.

`agent.deliveries` returns that Agent's delivery ledger, newest first by
`createdAt`, with `limit` between 1 and 100 (default 50). Each record carries
`chatId`, `source`, `workId`, `actionId`, `messageId`, `state` (`queued`,
`accepted`, `served`, `seen`), `turnId`, and the per-state timestamps `createdAt`,
`acceptedAt`, `servedAt`, and `seenAt`. `workId` is the durable identity for
either kind of work; `actionId` is populated for a committed action attention,
while `messageId` is null for that non-Chat work. Rows are retained after
settlement rather than deleted, so
"never delivered" and "delivered and answered with silence" read differently.
`turnId` is the run that consumed the row; it stays null when the seen cursor
subsumed the row instead of a turn settling it.

Managed Agent commands use `/api/agent/*`. The injected `grotto` wrapper calls a per-launch
Computer loopback proxy. Computer serves eligible inbox reads locally or forwards the request with
the scoped runner credential. The Agent process never receives a Server-valid credential.

An Agent-authored ordinary message may target `dm:@<active-agent-handle>` as well as its Owner DM.
The Server resolves that handle within the runner's Server to the target Agent's existing Owner DM,
then applies the same normal Chat delivery and inbox rules. The target must be active and cannot be
the sending Agent; this is a routing convenience, not a privileged delivery path.

### Transient avatar generation

`POST /api/agent/avatar/generate` accepts one required, trimmed `concept` (1–280 characters) and
returns exactly one Server-validated 256×256 PNG as base64 plus its byte size and media metadata.
The route is available only to a managed Agent runner. The Server owns the canonical pixel-art
prompt and substitutes only the validated concept; it sends one `gpt-image-2` request with no
reference image or current avatar input.

The image service center-crops and normalizes provider output, checks the ordinary 512 KiB avatar
ceiling and PNG signature, and keeps the result transient. The managed CLI writes the returned
bytes only to the caller-selected local path; no draft repository or Server avatar record is
created. One generation may be in flight per Agent and two per Server. Capacity responses are
`429` with `retryable: true`; provider, configuration, and output failures are safe retryable API
errors. Operational events carry actor, Server, request, model, duration, outcome, and normalized
metadata only — never concept text or image bytes.

### Task routes

`GET /api/agent/tasks` lists a target's tasks; `POST /api/agent/tasks/create`,
`/claim`, `/unclaim`, and `/update` mutate them. `claim` takes `target` plus either `numbers` or a
`messageId`; claiming a `messageId` that carries no task promotes the message first, so the claim
is what creates the task.

Every task projection carries `origin`, which says how the row came to exist:

| `origin` | Written by |
| --- | --- |
| `composed` | A human composing a message as a task. |
| `converted` | A human promoting an existing message with Convert to Task. |
| `claimed` | An Agent claiming a message nobody had promoted. |

The hosted task wire shape adds two derived fields on top of that. `tier` is `background` or
`tracked`: a background task is a `claimed` task in `in_progress` or `done` whose Thread has no
messages, that carries no Ask, whose status never left that pair — review, closure, or a reopen
stamps it tracked for good — and whose claiming run has not settled leaving the work open — an Agent's own orchestration lock, excluded from the default Board
and List. Everything else is `tracked`. `live` is true while the assignee Agent's in-flight run
holds that task's message or Thread; a run beginning and a run settling both emit `task.updated`,
so it is never polled. Both are computed per read and neither is a stored task column.

Promotion does not create the task's Thread. The Thread materializes on the first reply under its
deterministic `cht_thr_<anchor>` id, so `grotto message send --target "#channel:<messageId>"`
remains the way to open one, and a claim an Agent resolves inside its own turn leaves no work
surface behind.

A claim that loses to a claim someone else holds returns `409 TASK_CONFLICT` with the ordinary
`code` and `message`, plus a **`claimConflict`** object:

```json
{
  "code": "TASK_CONFLICT",
  "message": "That task is already owned by another assignee.",
  "claimConflict": {
    "kind": "claim_conflict",
    "conflictScope": "implementation_execution",
    "blockedActions": ["start_conflicting_execution"],
    "unblockedActionExamples": [
      "reading the task and its Thread",
      "replying in the Thread with findings, questions, or review",
      "claiming a different task in this lane",
      "raising the routing with the people in the original Chat"
    ],
    "currentAssignee": { "type": "agent", "name": "sage" },
    "status": "in_progress",
    "claimedAt": "2026-09-08T17:04:11.000Z",
    "observedAt": "2026-09-08T17:09:52.000Z"
  }
}
```

`blockedActions` is an authoritative closed set — an action absent from it is not blocked by this
conflict, though it remains subject to its own authority and policy — while
`unblockedActionExamples` is illustrative and never a permission table. `observedAt` is a snapshot,
not a standing ruling. `packages/grotto-api` owns the schema (`taskClaimConflictSchema`) and the
rendering copy: `taskClaimConflictBlockedActionCopy` maps each blocked action id to its prose, and
`TASK_CLAIM_CONFLICT_ROUTING_NOTE` is the closing sentence the CLI prints — a claim conflict is a
concurrency lock, not a ruling on who owns or leads the lane, and a misroute is corrected in the
original Thread. Grotto has no reassignment-request command, so no clause names one.
`grotto task claim` renders the block from the 409 body in place of the generic error line —
`apps/computer/src/agent-cli/agent-claim-conflict.ts` is the only place that prose is composed —
while a `TASK_CONFLICT` without a `claimConflict` keeps the ordinary refusal.

A successful claim prints one follow-up line per claimed task under `Follow up on each task:`:

```
#3 → reply in #all when done (same-turn work); use the thread "#all:b0Q8lLWk" for progress notes, questions, or work that outlives this turn.
```

The hint names both tiers on purpose. A claim finished inside the claiming turn is answered in the
Chat that asked — the background tier, which leaves no Thread behind — while the printed thread
target is for progress notes, questions, and work that outlives the turn, which is what stamps the
task tracked.

### Prepared Agent action cards

Managed Agents can post a native Agent-creation proposal to a current Chat:

```sh
printf '{"kind":"agent:create","name":"Orbit","description":"Release helper"}' \
  | grotto action prepare --target "#product" --avatar-file ./orbit.png
```

`grotto action prepare` accepts one strict `ActionCardAction` JSON object on stdin and a local
PNG, JPEG, or WebP avatar file up to 512 KiB. Version 1 exposes only `agent:create`; its optional
fields are `description` and `computer` guidance (`required` or `suggested` with a
Server-resolved Computer id). Runtime, model, role, and credentials are deliberately absent.
The Server resolves the target from the scoped runner, verifies the Agent's exact current Chat
view, and stores the proposal plus the exact avatar bytes in one transaction. The response is a
typed receipt containing the prepared action, its canonical Chat anchor, sequence, and idempotency
result.

Proposal commentary uses ordinary `grotto message send` content, not a field in the creation
configuration. The card is the deliverable; another message is useful only when it adds information
the card does not convey. The checked-in migration preserves historical proposal notes in their
existing Message content before removing the old field.

The same `(Server, proposer Agent, nonce)` and identical proposal/media returns the original
receipt. Reusing that nonce for different values returns `ACTION_IDEMPOTENCY_CONFLICT`. A newer
proposal from the same Agent for the same Chat and action kind creates a new immutable row and
marks the older pending row `superseded`; another Agent's pending proposal is isolated. If a
human or another Agent changed the target after the proposer last saw it, the Server returns
`ACTION_VIEW_STALE` and tells the Agent to read again before preparing.

Chat message reads project the prepared action through `preparedAction`; the anchor body remains
empty because the native card owns its presentation. The App renders known `agent:create` cards
with the exact media and pending, done, or superseded status. Unknown future kinds are inert
fallback cards. Human commit/edit is a separate follow-up contract; preparing an action never
creates an Agent or grants mutation authority.

### Asks

A managed Agent asks one named human for a decision with `grotto ask`:

```sh
grotto ask --target "#product" --to @ada --title "Run the staged migration?" \
  --summary "The migration is staged and reversible for one hour." \
  --step "Approve the staged migration" <<'GROTTOMSG'
The migration is staged. Should I run it now, or wait for the release window?
GROTTOMSG
```

`POST /api/agent/asks` takes `{ addresseeHandle, content, nonce, recommendedStep, summary, target,
title }` and returns `{ ask, chatId, idempotent, messageId, sequence, target }`. The question text is
the Message content and is required; `title` is at most 120 characters, `summary` 500, and
`recommendedStep` 200. The Server resolves the target under the runner's own Agent and Server
authority, resolves the handle in the shared human/Agent handle namespace, and requires an active
human member with access to that Chat — an unknown handle, an Agent handle, or a member without Chat
access returns `ASK_ADDRESSEE_NOT_FOUND` and writes nothing.

One transaction writes the Agent-authored Message with `body_kind = 'ask'`, the `asks` row, the
deterministic child Thread when the Ask is top-level, ordinary delivery planning, and both the
`message.created` and `ask.updated` events. It is idempotent by `(Chat, nonce)`; the same nonce with
different values returns `ASK_IDEMPOTENCY_CONFLICT`. An Ask posted inside a Thread stays in that
Thread, because Threads do not nest.

The first reply in the Ask's Thread from anyone other than the asking Agent settles it in that
reply's own transaction, recording the answering human or Agent and the answer Message. Humans and
Agents both settle; the addressee is who Grotto notifies, not who Grotto permits. There is no answer
route — settlement is a side effect of the ordinary send paths — and no mutation of any other
record. `ask.listOpen({ serverId })` is the human read for the Inbox, and it carries the
conversation the answer is addressed to plus the Thread anchor a reply hangs off, so an Ask posted
inside a Thread is answerable from the Inbox like any other.

Every Agent-facing Message states its `body_kind` (`text | ask | cloud-agent-work`), and an Ask
Message carries `ask: { id, status, addressee_handle, title, recommended_step }` beside it. The
Agent CLI appends `[ask status=open|answered to=@handle]` to that Message's history line and
delivery envelope, after the task suffix
([Grotto CLI](../../specs/grotto-cli.md#4-envelopes-and-message-lines)).

### Cloud Agent work

A managed Agent delegates bounded repository work to a provider-hosted agent with
`grotto cloud-agent start`:

```sh
grotto cloud-agent start --target "#product" --repo grotto/grotto --ref main \
  --title "Fix the flaky delivery test" \
  --say "Handing the flaky delivery test to a cloud agent." <<'GROTTOMSG'
Reproduce the failure, fix it, and open a pull request.
GROTTOMSG
```

This command runs on the Computer rather than upstream. The Computer checks
`CloudAgentProvider.readiness()` first, so an unavailable capability fails with
`CLOUD_AGENT_UNAVAILABLE` before Server records anything, and it keeps the stdin instructions
local: they reach the provider and never Server.

`POST /api/agent/cloud-agents` takes `{ content, nonce, provider, repository, startingRef, target,
title }` and returns `{ chatId, idempotent, messageId, runId, sequence, target, work }`. `content`
is the Agent's own words and becomes the Message content; `title` is at most 120 characters and
`repository` reads as `owner/name`. One transaction writes the Message with
`body_kind = 'cloud-agent-work'`, the `cloud_agent_work` row, its first `cloud_agent_runs` row in
`queued`, the deterministic child Thread when the work is top-level, ordinary delivery planning,
and both the `message.created` and `cloud-agent-work.updated` events. It is idempotent by
`(Chat, nonce)`; the same nonce with different values returns
`CLOUD_AGENT_IDEMPOTENCY_CONFLICT`. The Computer then calls `provider.start()`; a provider that
refuses settles that same recorded work as `failed` with an error code and returns
`CLOUD_AGENT_LAUNCH_FAILED` rather than erasing the attempt.

`grotto cloud-agent send --work <workId>` takes follow-up instructions on stdin. The Computer
accepts `{ workId, nonce, instructions, interrupt }` at `POST /api/agent/cloud-agents/send`, retains
the instructions locally, and forwards `{ workId, nonce }` to Server. Server returns
`{ work, runId, idempotent, predecessors }` for a Run on the existing work. Computer sends it to the
same hosted agent after preceding work settles, or stops active work and discards older queued
prompts when `interrupt` is true. Pending instructions stay in a private Computer-local journal
until launched or cancelled. Revisions reuse the Work ID, work Message, and Thread. Each settled
Run gets its own inbox attention; callers do not need to manage provider Run IDs.

`grotto cloud-agent inspect` uses `GET /api/agent/cloud-agents` to read `{ works }` for the caller's
delegated work. An optional `workId` query selects one work with its recorded results. These are
Server records, not a live provider transcript.

`grotto cloud-agent stop --work <workId>` uses `POST /api/agent/cloud-agents/cancel`. The published
`cancel` CLI spelling remains a compatibility alias. The endpoint takes `{ workId }` and is
authorized to the delegating Agent alone; `cloudAgentWork.cancel({ serverId, workId })` is the
Owner/Admin equivalent. Both record
`cancelRequestedAt` and `cancelRequestedBy` and send a `cloud-agent-cancel` frame to the assigned
Computer. Cancelling settled work returns `CLOUD_AGENT_WORK_SETTLED`.

Computer reports lifecycle over the attachment socket as a `cloud-agent-observation` frame carrying
`{ workId, runId, status, observedAt }` plus optional provider ids and URL, raw status, bounded
`activity` and `summary`, error code, reported branches, and usage. Server applies it idempotently:
a duplicate, out-of-order, or post-terminal observation changes nothing. A settled Run creates
exactly one `agent_inbox` attention for the delegating Agent, keyed by the Run id. The latest Run
owns the work's displayed status, so an earlier Run settling cannot finish a queued follow-up.
On reconnect Server pushes `cloud-agent-reconcile` frames of at most 200 entries covering every
non-terminal Run that Computer still owns, with any cancel recorded while it was offline; Computer reads each
Run from the provider and reports what it finds. `cloudAgentWork.listActive({ serverId })` is the
human read behind the Inbox.

#### Cloud Agent provider access

Cloud Agent provider access is a Computer capability with its own credential store, separate from
the Cursor runtime harness even when both belong to one Cursor account. Each Computer reports it in
its inventory as `cloudAgentProviders: [{ provider, ready, reason }]`, where an unready reason is
`not-connected`, `expired`, or `provider-unavailable`.

`cloudAgentProvider.get`, `cloudAgentProvider.connect`, and `cloudAgentProvider.disconnect` each
take `{ computerId, provider, serverId }` and answer with the Computer's own
`{ accountEmail, expiresAt, provider, ready, reason }`. Server verifies current membership plus
Owner or Admin authority, verifies the Computer belongs to that Server, and relays a
`cloud-agent-capability-request` over that Computer's outbound socket, which answers with
`cloud-agent-capability-result` — the same shape [Browser](../internals/browser.md) uses, for the
same reason: the App never touches a Computer socket.

`connect` runs the provider's own browser sign-in on the Computer and stores the key in the
provider's credential store; `disconnect` forgets it, and the key stays revocable from the
provider's dashboard. Server holds no provider credential and stores none — only readiness and the
account it resolves to cross the boundary. Connecting waits up to five minutes because a human
finishes the flow, and Grotto never opens it during an Agent turn.

`preparedAction.commit` is the human follow-up mutation. It is Server-scoped and accepts the
prepared action id plus the submitted display name, description, handle, Computer, runtime,
model, reasoning effort, and optional replacement avatar bytes. Only the current Owner or Admin
may call it. The Server locks and revalidates the pending action, originating Chat anchor,
current Computer inventory, and ordinary Agent invariants before one PostgreSQL transaction
creates exactly one Member Agent, its Owner DM, and a copied avatar. The same transaction stores
the executed result with the submitted values and committing human, appends the durable
`prepared-action.updated` event, and writes the record-only proposer attention. After
the transaction, Server dispatches that attention through the proposing Agent's
ordinary durable delivery lifecycle. Replays return the stored result without
creating another attention; concurrent submissions create one Agent. The new Agent
is configured without an empty bootstrap turn. Validation or transaction failure
leaves the action pending.

Each settled turn summary includes its runtime and model plus normalized input,
output, cache-read, and cache-write counts when the runtime reports them. Server
persists those bounded counters for usage aggregation; raw usage payloads and
execution traces remain Computer-local.

Wire schemas live in `packages/grotto-api`; Server handlers live in `apps/server/src/agent-api/`
and `apps/server/src/grotto-api/agent/`; Computer proxy and launch behavior live in
`apps/computer/src/`.

Hosted Agent execution detail is a separate, explicit `agent.executionJournal` query. It accepts
one `serverId`, `agentId`, and `runId`; Server authorizes only Owners/Admins, resolves the Agent's
assigned Computer, and relays the request over that authenticated attachment. The response is
either the Computer-local journal or an explicit `unavailable` result (`offline`, `missing`, or
`timeout`). Server does not persist the journal, and ordinary members never receive it.

An available journal carries `runId`, `status`, timestamps, a `tools` array (tool-call id, observed
identity, input, `output`, `error`, `preliminary`, `final`, interruptions, and timings), and an
optional `reasoning` array of `{ id, startedAt, endedAt?, text, truncated? }` blocks capped at
64,000 characters each and 1,000 blocks per turn. Reasoning exists only in this response. Every
other string leaf the journal carries is capped at 256,000 characters and ends with
`…[truncated N more characters]` when clipped, so one oversized tool output cannot dominate the
relayed response.

A running turn is answered from the Computer's append-only `<runId>.ndjson` log and a settled one
from the consolidated `<runId>.json` snapshot; both live under the Agent's
`runtime/execution-journal/` directory and neither reaches the Server's store.
