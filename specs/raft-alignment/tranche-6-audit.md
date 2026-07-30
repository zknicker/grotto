# Tranche 6 audit — reminders and autonomous follow-up

Audit date: 2026-07-30  
Grotto revision at audit start: `a21591494`  
Status: corrective implementation and focused/live verification complete

## Method

1. Read the Raft Computer and daemon reminder paths alongside Grotto Computer,
   Server, delivery, CLI, and reminder specifications.
2. Use Raft and a fresh isolated Grotto stack as an ordinary user with matched
   requests and GPT-5.6 Terra Agents.
3. Observe the scheduled action and later business result separately.
4. Verify offline, ownership, retry, recurrence, and race behavior in focused
   deterministic lanes rather than disrupting either live service.

Live evidence remains in:

- Raft `#reminder-audit-jul30`:
  `https://app.raft.build/s/arcade/channel/e44cc762-ab2f-4bc8-9586-42d637bcef28`
- Grotto `#reminder-audit-jul30`: chat `cht_ICPqw08XJFhKBRx6`

## Scenario results

| Scenario | Raft | Grotto | Result |
| --- | --- | --- | --- |
| One-shot follow-up | Cindy checked two minutes later and replied in the source Thread that the exact `READY` update was still pending. | Wren scheduled visibly, fired visibly, and replied in the source Thread that it was still pending. | Pass. |
| Natural-language “tomorrow” | Cindy scheduled directly for the next day and explained that the reminder would wake her. | Wren also scheduled directly for the next day. | Pass. Live Raft does not treat “tomorrow” as materially ambiguous. |
| Agent-owned approval follow-up | Cindy checked once after two minutes and replied that approval was still awaiting. | Wren scheduled the same check against the source message and produced the same result after the fire. | Pass. |
| Offline fire and reconnect | Raft source keeps Server state authoritative and uses reconnect snapshot recovery for one overdue logical slot. | A deterministic Server/Computer delivery lane fires while offline, delivers once on reconnect, clears attention after output, and does not replay. | Pass. |
| Mutation lifecycle | Raft uses versioned reminder upsert/cancel records and stale-version rejection. | Schedule, snooze, update, and cancel now carry client command ids and expected versions through the actual Agent CLI route. Identical retries return the original result. | Pass after fix. |
| Cancel/fire race | Raft rejects stale local state by reminder version while Server owns lifecycle. | PostgreSQL row locks and expected versions linearize cancel against a due fire. | Pass in the existing deterministic race lane. |
| Ownership | Raft reminders are credential-bound to their author. | Runner credentials resolve one Agent; list and mutation paths require that same Agent to own the reminder and retain anchor access. | Pass by source and service coverage. |

## Corrective implementation

| Finding | Resolution |
| --- | --- |
| Agent reminder routes replaced client idempotency/version data | The Computer CLI now authors command ids, reads the current version before mutation, and the Server passes both fields unchanged into reminder services. |
| Relative-delay retries changed their own fingerprint | The Computer converts `--delay-seconds` to one absolute `fireAt` before the request. A retry reuses the exact request and command id. |
| Ordinary offline reminder delivery lacked a cross-layer proof | Added a deterministic offline fire → reconnect → Agent output → attention-clear lane, including no second delivery on another reconnect. |
| Reminder behavior could disappear from Computer instructions unnoticed | Added executable assertions for user/self-driven scheduling, author-only wake, no long sleeps or memory wakes, Grotto reminder ownership, and snooze/update reuse. |
| Specs excluded owning-Agent DMs and overstated settlement | Specs now include Agent DMs and recognize a durable send before later cleanup failure as proof the reminder was handled. |

## Raft principles retained

- Server state is authoritative; Computer state is disposable execution state.
- A reminder wakes only its author through the normal Agent delivery path.
- Scheduling does not keep a model turn alive and memory never acts as a timer.
- Every logical fire is durable, anchored, observable, and delivered at most
  once after recovery.
- Recurrence advances from the present after downtime; missed slots do not
  burst.
- Agents update or snooze existing work instead of creating duplicate
  reminders.
- Command ids make retries idempotent; versions make stale mutations explicit.
- A fire receipt is delivery evidence, not proof of the requested business
  outcome.

## Intentional difference

Grotto supports an optional bounded Computer-local script payload. The installed
Raft Computer/daemon reminder path does not expose or execute scripts. Script
reminders remain a Grotto extension and were not used to claim Raft parity.
