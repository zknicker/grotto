---
read_when:
  - reviewing the Agent E2E creation, first-turn readiness, or retirement baseline
---

# Agent provisioning — 2026-07-30

The matched interaction used GPT-5.6 Terra with medium reasoning.

## Comparison baseline

Workspace: `arcade`

- Agent: `BluebirdQA`
- Evidence:
  `https://app.raft.build/s/arcade/agent/bbfaee9a-226b-484d-9bfc-cf70734f218d?agentTab=workspace`

The user created BluebirdQA on an existing online Computer, chose Codex,
GPT-5.6 Terra, and medium reasoning, then sent an ordinary DM asking for a
three-section `bluebird-brief.md`. The Agent claimed the work, acknowledged
it in the task Thread, created the file, returned a concise completion, and
moved the task to review. Its Workspace exposed the requested file,
`MEMORY.md`, and seeded notes.

The gates are explicit provisioning, exact desired configuration, immediate
ordinary-DM usability, seeded workspace readiness, durable requested output,
and collaboration-history preservation after retirement. Exact prose,
latency, and starter-kit filenames beyond the durable product contract are
observations.

## Grotto result

The browser-driven Grotto scenario lives in `agent-provisioning.spec.ts`.

Grotto matched the live behavior:

- the Owner created Juniper through the Members UI;
- its profile became `Current` with Codex and GPT-5.6 Terra;
- the profile exposed the managed `tavern-agent` and `visuals` skills;
- an ordinary DM became Agent-owned work in its task Thread;
- Juniper acknowledged, created `bluebird-brief.md`, and reported completion;
- Workspace exposed `MEMORY.md`, seeded notes, and the requested file.

The executable scenario additionally retires the temporary Agent through the
real confirmation UI and verifies that it leaves the member list.

The first tightened run incorrectly waited for an Agent message in the parent
DM. Grotto had completed the turn and created the file in 57 seconds, but both
Agent messages correctly lived in the source message's child Thread. The test
now resolves that Thread from the canonical message receipt, opens it through
the visible reply affordance, and verifies the shared file link there.

The App now matches the retention contract. After the Chat list invalidates,
the retired Agent's Owner DM stays listed and reachable by direct URL, keeps the
Agent's name, and is clearly labeled Retired with a closed composer. The
executable scenario navigates to the DM by URL and asserts the preserved
history, the Retired label, and the absent composer.

Verification:
`TAVERN_DEV_STACK_ID=agent-e2e bun run eval:agents -- agent-provisioning.spec.ts`
(`2 passing flows`).

Matched screenshots:

- `.context/agent-e2e/evidence/2026-07-30-comparison-agent-provisioning.png`
- `.context/agent-e2e/evidence/2026-07-30-grotto-agent-provisioning.png`
