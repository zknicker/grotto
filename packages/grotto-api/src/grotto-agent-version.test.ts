import { expect, test } from 'bun:test';
import manifest from '../grotto-agent.json' with { type: 'json' };
import { agentEffectiveStateSchema, grottoAgentReportFrameSchema } from './agent.ts';
import { grottoAgentVersion } from './grotto-agent-version.ts';

test('exports the release-owned Grotto Agent version', () => {
    expect(grottoAgentVersion).toBe(manifest.version);
    expect(grottoAgentVersion).toMatch(/^\d+\.\d+\.\d+$/u);
});

test('keeps version receipts out of the legacy strict Computer report', () => {
    expect(
        agentEffectiveStateSchema.safeParse({
            agentId: 'agt_legacy',
            grottoAgentAppliedAt: null,
            grottoAgentStatus: 'pending',
            grottoAgentVersion: null,
            modelId: 'gpt-5.6-sol',
            runtimeId: 'codex',
        }).success
    ).toBe(false);
    expect(
        grottoAgentReportFrameSchema.parse({
            agents: [{ agentId: 'agt_legacy', appliedAt: null, status: 'pending', version: null }],
            type: 'grotto-agent-report',
        })
    ).toMatchObject({ agents: [{ status: 'pending', version: null }] });
});
