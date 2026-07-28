import { describe, expect, test } from 'bun:test';
import type { ConfiguredAgentRow } from '../src/hosted-agents/agent-shape.ts';
import { deriveAgentAvailability } from '../src/hosted-agents/agent-shape.ts';

const base: ConfiguredAgentRow = {
    activeRunId: null,
    computerHealth: 'healthy',
    computerId: 'cmp_1234567890123456',
    consecutiveFailures: 0,
    createdAt: new Date('2026-07-28T00:00:00Z'),
    description: null,
    desiredModelId: 'gpt-5.6-sol',
    desiredRuntimeId: 'codex',
    displayName: 'Cove',
    dmChatId: null,
    effectiveMissing: [],
    effectiveModelId: 'gpt-5.6-sol',
    effectiveReportedAt: new Date('2026-07-28T00:00:00Z'),
    effectiveRuntimeId: 'codex',
    handle: 'cove',
    id: 'agt_1234567890123456',
    role: 'member',
    serverId: 'srv_1234567890123456',
    stopped: false,
};

describe('hosted Agent availability', () => {
    test('an applied Agent is offline when its assigned Computer is offline', () => {
        expect(
            deriveAgentAvailability({
                ...base,
                computerHealth: 'offline',
            })
        ).toBe('offline');
    });

    test('projects working, stopped, error, and idle from Server-owned facts', () => {
        expect(deriveAgentAvailability({ ...base, activeRunId: 'run_123' })).toBe('working');
        expect(deriveAgentAvailability({ ...base, stopped: true })).toBe('stopped');
        expect(deriveAgentAvailability({ ...base, consecutiveFailures: 1 })).toBe('error');
        expect(deriveAgentAvailability(base)).toBe('idle');
    });
});
