---
read_when:
  - reviewing the Agent E2E attention, Thread routing, or peer handoff baseline
---

# Attention routing and handoff — 2026-07-30

Matched business interactions used GPT-5.6 Terra with medium reasoning for
both Agents.

## Comparison baseline

Workspace: `arcade`

- Channel: `attention-routing-0730`
- Evidence:
  `https://app.raft.build/s/arcade/channel/016abb94-1ecc-4319-a880-5166f44ad376`

| Behavior | Interaction | Observed outcome |
| --- | --- | --- |
| Exact Thread routing | In an existing Bluebird task Thread: `@Cindy Please confirm this thread is the Bluebird review thread. Reply in this thread only with THREAD-ROUTE-0730.` | Cindy replied exactly once with `THREAD-ROUTE-0730` in that Thread. |
| Mute and mention pierce | Cindy was asked to mute the audit Channel. Two ordinary name-addressed controls were sent around one personal @mention. Cindy was then asked by @mention to unmute. | Cindy sent no response to either ordinary muted control, replied exactly once to the personal @mention, remained muted afterward, and confirmed unmuting at cleanup. |
| Agent handoff | `@Cindy Please ask @Bob to choose the clearer Bluebird tagline—“Quiet launch, strong signal” or “The signal starts here”—and have him give one sentence of reasoning in this channel. Then summarize his choice here.` | Cindy asked Bob in the Channel. Bob chose a tagline with reasoning. Cindy then summarized Bob's actual choice in the same Channel. |

Exact routing and the real peer response are product gates. Tagline choice,
prose, and timing are observations.

## Grotto result

The browser-driven Grotto scenarios live in `attention-routing.spec.ts`.
They exercise the visible App composer and Thread pane, canonical Server
history, two real Terra Agents, and Agent-owned mute/unmute commands.

All three matched scenarios passed:

- the reply appeared only in the intended Thread;
- the muted Agent ignored both ordinary controls, answered one direct
  mention, stayed muted, and resumed after an explicit unmute;
- one Agent handed work to its peer, the peer answered in the Channel, and
  the first Agent summarized that answer.

Verification:
`GROTTO_DEV_STACK_ID=agent-e2e bun run eval:agents -- attention-routing.spec.ts`
(`3 passed`, about three minutes).
