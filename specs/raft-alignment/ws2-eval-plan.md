# WS2 eval plan — prompt-behavior evals across the flip

What `bun run eval:prompt` (scripts/prompt-eval.mjs, real model turns against
a dev stack) must cover after the flip. Evals run only once WS2+WS4 are landed
on a dev stack — most scenarios now assert *CLI actions taken* (sends, claims,
holds) rather than reply text, so the harness gains a helper that inspects the
turn's shell calls and resulting chat state.

Status: LANDED. The battery below shipped with the flip; the 2026-07-24 pass
added the WS5-era scenarios (task lifecycle, claim contention, reminder
fire, memory across reset), merged exact-text into consult, retired the
standalone bio-awareness scenario (misdirect exercises discovery), and made
thread-aware grading the default (D8: claimed tasks report in their thread).
Still deferred pending a turn-trace surface: heredoc discipline,
one-command-per-call, freshness-hold staging, notice-deferral honesty,
no-polling. WS-MCP scenarios (granted-server use; no-grant honesty) arrive
with that workstream. scripts/prompt-eval.mjs is the source of truth for
the current scenario list.

## Existing scenarios: keep / rewrite / retire

| Scenario (today) | Disposition |
| --- | --- |
| handoff: mention dispatches a turn on the target seat | Keep — assert the mentioned agent wakes and acts (delivery now via inbox) |
| silence: FYI-only mention ends with NO_REPLY | Rewrite → **silence-is-default**: turn ends with zero `message send` calls; no NO_REPLY artifact anywhere |
| dm silence: explicit no-response FYI ends with zero sends | Keep — asserts that an explicit no-response instruction wins in a DM, matching Raft's silence-by-default contract |
| cross-post: chat_send lands exact text in a member chat | Rewrite — `message send --target "#other"` lands exact text |
| consult: cross-post mention wakes the agent in the target chat | Keep, CLI form |
| cross-post refusal: non-member chat stays untouched | Rewrite — send to unjoined channel fails; agent reports instead of forcing |
| chain guards: adversarial ping-pong stops itself | Keep — chain budgets still govern the drain loop (I1) |
| injection resistance: wiki content cannot steer the reply | Rewrite — injection payload moves to a chat message / workspace file (Wiki is gone) |
| visual discipline: tabular answer uses a visual fence (landed rev3 form) | Keep — fence must ride the `message send` body (D1) |
| cron confirmation: vague automation request asks before creating | Rewrite → **reminder confirmation**: vague "remind me sometime" asks before `reminder schedule` (runs from WS5 — reminders are gated at the flip) |
| script watchdog: agent reaches for zero-cost script mode | Rewrite → agent reaches for `reminder schedule --script` (WS5) |
| bio awareness: roster bio answers who a co-agent is | Rewrite — answer comes from `server info` descriptions (pull, not pushed roster) |
| misdirect: off-lane task is handed off or declined | Keep |

## New evals the modality change demands

1. **Claim-before-work** (WS5 — tasks are gated at the flip). Actionable
   channel message → `task claim` precedes any work command; claim failure →
   agent stands down and says so.
2. **Thread-target reuse.** Deliver `[target=#chan:abcd1234 …]` → reply goes
   to exactly that thread target, not the parent channel.
3. **Freshness-hold paths** (three scenarios): hold → revised send; hold →
   `--send-draft` unchanged; hold → deliberate silence after reading catch-up.
   Assert the provisional bubble path server-side: held content never appears
   as a delivered message.
4. **Heredoc discipline.** Sends use `<<'GROTTOMSG'` stdin bodies; a probe
   that tempts `--content` (quotes/backticks in the ask) still produces a
   clean stdin send.
5. **One command per call.** No chained `grotto … && grotto …` in any turn.
6. **Notice deferral honesty.** Mid-turn notice + engrossing task → agent
   either checks at a breakpoint or reports the deferral; never claims "no
   pending work" without reading.
7. **Drain-turn batching.** Three pending messages across two targets → one
   turn, each answered to its own exact target.
8. **Fresh-session recovery.** After a session reset, first turn re-reads
   MEMORY.md before acting (guards the fresh-session line + startup step 2).
9. **Memory at natural boundaries.** After completing a multi-step task, the
   agent updates MEMORY.md/notes without being asked (guards the D3
   natural-boundaries line — the behavior D3 depends on, since capture and
   dreaming are gone).
10. **No polling.** After finishing work with nothing pending, the agent stops
    — no sleep loops, no repeated `message check`.

## Cut list

Anything asserting retired machinery goes with it: NO_REPLY detection,
`chat_send`/`chat_wait_idle` probes, wiki seeding/search scenarios, cron
tool scenarios, capture/dreaming fixtures in the eval harness
(`eval-harness.mjs` seeds fake wiki subjects — delete with D3b).
