import { expect, test } from 'bun:test';
import { toReportedAgentState } from './computer-report.ts';

test('reported Agent state preserves reasoning effort', () => {
    expect(
        toReportedAgentState({
            agentId: 'agt_effective',
            grottoAgentAppliedAt: null,
            grottoAgentStatus: 'current',
            grottoAgentVersion: '1.0.0',
            missingResources: [],
            modelId: 'gpt-5.6-sol',
            reasoningEffort: 'high',
            runtimeId: 'codex',
        })
    ).toEqual({
        agentId: 'agt_effective',
        missingResources: [],
        modelId: 'gpt-5.6-sol',
        reasoningEffort: 'high',
        runtimeId: 'codex',
    });
});
