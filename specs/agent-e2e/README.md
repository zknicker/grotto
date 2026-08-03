---
read_when:
  - changing Agent delivery, attention, tasks, sessions, MCP, skills, workspace, or reminders
  - adding or reviewing live Agent end-to-end coverage
  - auditing Agent behavior after a cross-cutting architecture change
---

# Agent E2E

Agent E2E verifies Grotto's user-visible Agent contract through the real App,
Server, Computer, and model. Research products can establish an expected
baseline, but scenario names and assertions describe only Grotto behavior.

## Method

1. Establish the expected behavior through product research and record the
   prompt, model, transcript, timing, and screenshots.
2. Repeat the same business interaction in Grotto through the real App UI.
3. Record the Grotto result before changing implementation.
4. Encode stable user-visible behavior in the live browser suite.
5. Keep internal races, retries, bounds, and failure injection in deterministic
   Server or Computer tests.
6. Keep subjective model choices as observations rather than brittle gates.

Use GPT-5.6 Terra by default. Use GPT-5.6 Sol only when the scenario itself
requires materially stronger research, planning, or instruction following.

## Coverage classes

| Class | Proves | Rule |
| --- | --- | --- |
| Agent E2E | A human action in the App produces the promised visible Agent outcome. | Drive the real composer and observe the real UI. |
| Browser E2E | Deterministic App navigation, cache, reconnect, and presentation behavior. | Use the isolated Playwright stack and fake only the model boundary. |
| Deterministic | Durability, races, retries, authorization, bounds, and recovery invariants. | Use real product services and stores; fake only external boundaries, time, or failure. |
| Observation | Useful model judgment without a deterministic required outcome. | Record evidence; do not gate releases on one sample. |

## Scenario ledger

Status values:

- `mapped`: the behavior and existing coverage are identified.
- `baseline`: matched product observations are recorded.
- `passing`: Grotto passed and executable coverage is enabled.
- `quarantined`: Grotto failed; the executable scenario records the gap but is
  not part of the green release lane.

### Tranche 1 — Resident delivery and recovery

| ID | Grotto behavior | Coverage | Status |
| --- | --- | --- | --- |
| D1 | Addressing an Agent wakes it and produces one reply in the addressed target. | Agent E2E | passing |
| D2 | One Agent drains work from multiple Chats without losing or conflating targets. | Agent E2E + deterministic serialization | passing |
| D3 | Work arriving during an active turn is noticed and handled at a safe boundary. | Agent E2E + deterministic freshness | passing |
| D4 | Work queued while the Computer is offline is delivered once after reconnect. | Deterministic | passing |
| D5 | A transient Agent or Computer failure resumes pending work without duplicate output. | Deterministic | passing |
| D6 | Replayed or duplicate delivery does not create a duplicate Agent turn result. | Deterministic | passing |
| D7 | One Agent retains conversational context across different Chats. | Agent E2E | passing |
| D8 | Restart resumes the same session and preserves context. | Deterministic session contract | passing |
| D9 | Start fresh session starts a new harness session while preserving canonical Chats, workspace, memory, and skills. | Deterministic reset contract | passing |
| D10 | Full reset clears context and restores the Agent workspace to the starter kit. | Deterministic reset contract | passing |
| D11 | Changing runtime/model applies exactly to the next delivery. | Deterministic configuration | passing |
| D12 | Stop holds new work and Start drains it without changing the session generation. | Deterministic delivery | passing |

### Tranche 2 — Inbox, attention, and response discretion

| ID | Grotto behavior | Coverage | Status |
| --- | --- | --- | --- |
| A1 | A direct mention wakes the intended Agent and not another Agent. | Agent E2E | passing |
| A2 | An explicit no-response FYI in a Channel produces no Agent message. | Agent E2E | passing |
| A3 | An explicit no-response FYI in a DM produces no Agent message. | Agent E2E | passing |
| A4 | An ordinary DM receives one concise answer without routine narration. | Agent E2E | passing |
| A5 | Muting or unfollowing suppresses ordinary work while a later direct mention can wake the Agent once. | Agent E2E + deterministic attention | passing |
| A6 | A Thread delivery is answered in that exact Thread rather than its parent Chat. | Agent E2E | passing |
| A7 | Agent-authored handoff targets the intended Chat or member and wakes the recipient. | Agent E2E + deterministic authorization | passing |

### Tranche 3 — Task ownership and work lifecycle

| ID | Grotto behavior | Coverage | Status |
| --- | --- | --- | --- |
| T1 | Promoting a message creates one task with that message's Thread as its work surface. | Browser E2E + deterministic | passing |
| T2 | An Agent claims actionable work before acting and reports in the task Thread. | Agent E2E | passing |
| T3 | Competing claims produce one owner; the loser stands down. | Deterministic race + prompt contract | passing |
| T4 | An Agent can acknowledge work, deliver the result, and advance the task state. Useful unsolicited progress is model judgment and remains an observation. | Agent E2E + observation | passing |
| T5 | A task status update uses fresh Thread context rather than stale delivery context. | Agent E2E + deterministic freshness | passing |
| T6 | Losing membership or task access prevents further reads and mutations. | Deterministic authorization | passing |

### Tranche 4 — Agent creation, onboarding, and retirement

| ID | Grotto behavior | Coverage | Status |
| --- | --- | --- | --- |
| P1 | A new Server is Agent-free until an Owner explicitly provisions one. | Deterministic | passing |
| P2 | An Owner creates an Agent from reported Computer/runtime/model choices and can message it. | Agent E2E + Browser E2E | passing |
| P3 | A new general-purpose Agent starts with its workspace, memory, managed skills, and onboarding guidance ready. | Agent E2E + deterministic starter-kit contract | passing |
| P4 | Invalid or unavailable runtime/model choices fail closed while offline desired configuration remains visible. | Deterministic configuration | passing |
| P5 | Deleting an Agent retires execution state and releases work while preserving collaboration history. | Agent E2E + deterministic cleanup | passing |

### Tranche 5 — MCP, skills, and workspace

| ID | Grotto behavior | Coverage | Status |
| --- | --- | --- | --- |
| M1 | An Agent uses an assigned Server-owned MCP connection for appropriate work. | Agent E2E | passing |
| M2 | Revoking an MCP grant prevents later use and produces an honest access diagnosis. | Agent E2E + deterministic authorization | passing |
| M3 | Importing a skill makes it available to that Agent on its next turn. | Agent E2E + deterministic settlement | passing |
| M4 | An Agent creates a workspace file and can read it from a fresh model session. | Agent E2E | passing |
| M5 | A workspace artifact shared in Chat opens the correct Agent-owned file in the App. | Agent E2E + Browser E2E | passing |
| M6 | Unavailable MCP connections, bounded skill traversal, and stale edits fail independently and safely. | Deterministic | mapped |

### Tranche 6 — Reminders and autonomous follow-up

| ID | Grotto behavior | Coverage | Status |
| --- | --- | --- | --- |
| R1 | An Agent schedules a one-shot follow-up and later replies in the source Thread. | Agent E2E | passing |
| R2 | A natural-language future time schedules directly when it is unambiguous. | Agent E2E | passing |
| R3 | A follow-up checks the requested business condition rather than merely announcing that a timer fired. | Agent E2E | passing |
| R4 | A reminder firing while its Computer is offline is delivered once after reconnect. | Deterministic | passing |
| R5 | Schedule, snooze, update, cancel, and retry preserve one logical reminder. | Deterministic | passing |
| R6 | Cancel and fire races resolve to one authoritative lifecycle outcome. | Deterministic | passing |
| R7 | Only the owning Agent can manage or receive its reminder. | Deterministic authorization | passing |

### Tranche 7 — Multi-Agent coordination

| ID | Grotto behavior | Coverage | Status |
| --- | --- | --- | --- |
| C1 | A coordinator divides independent work into owned lanes and synthesizes one recommendation from their evidence. | Agent E2E | passing |
| C2 | A verifier reviews the author's actual output before the coordinator presents the reviewed result. | Agent E2E | passing |
| C3 | A time-bounded coordinator reports received and pending input honestly instead of waiting forever or treating silence as evidence. | Agent E2E | passing |
| C4 | A mid-flight human correction reaches active lanes and changes the final synthesis. | Agent E2E + deterministic freshness | passing |
| C5 | A coordinator preserves contradictory owned evidence and asks the human to resolve a conflict instead of inventing a winner. | Agent E2E | passing |
| C6 | A standing owner transfers a recurring lane with evidence and remains the backstop until the new owner proves one real delivery. | Observation | mapped |

### Tranche 8 — Durable handoff

| ID | Grotto behavior | Coverage | Status |
| --- | --- | --- | --- |
| H1 | A fresh Agent continues another Agent's sourced work from its durable Thread and shared artifact without the human restating the assignment. | Agent E2E + deterministic Thread identity | passing |

## Existing executable lanes

- `bun run eval:prompt` drives real Server-to-Computer-to-model behavior but
  sends through the public tRPC contract rather than the App composer.
- `bun run eval:sessions` drives real session behavior through the same hosted
  contract.
- `bun run eval:agents` drives the real App composer against the running
  development Server, Computer, and configured models.
- `bun run test:e2e` drives the real App against an isolated hosted Server,
  PostgreSQL, and Clerk stack. Computer inventory and Agent-authored effects are
  deterministic fixtures; it never calls a real model.

The Agent E2E lane complements these. It does not replace deterministic
failure-mode coverage or browser-only UI regressions.

## Observations

- [2026-07-30 attention and cross-Chat delivery](./observations/2026-07-30-attention-and-delivery.md)
- [2026-07-31 delivery and recovery invariants](./observations/2026-07-31-delivery-and-recovery-invariants.md)
- [2026-07-30 attention routing and handoff](./observations/2026-07-30-attention-routing-and-handoff.md)
- [2026-07-30 task lifecycle](./observations/2026-07-30-task-lifecycle.md)
- [2026-07-30 Agent provisioning](./observations/2026-07-30-agent-provisioning.md)
- [2026-07-30 MCP, skills, and workspace](./observations/2026-07-30-mcp-skills-workspace.md)
- [2026-07-31 Agent artifact pane](./observations/2026-07-31-agent-artifact-pane.md)
- [2026-07-30 reminders and follow-up](./observations/2026-07-30-reminders-and-follow-up.md)
- [2026-08-02 durable relay](./observations/2026-08-02-durable-relay.md)
