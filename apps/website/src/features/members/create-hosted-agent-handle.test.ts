import { describe, expect, test } from 'bun:test';
import { createHostedAgentHandle } from './create-hosted-agent-handle.ts';

describe('createHostedAgentHandle', () => {
    test('derives a valid handle without exposing a second identity field', () => {
        expect(createHostedAgentHandle('  Research & Ops  ', [])).toBe('research-ops');
        expect(createHostedAgentHandle('A', [])).toBe('a-agent');
    });

    test('chooses the next available handle', () => {
        expect(createHostedAgentHandle('Cove', [{ handle: 'cove' }, { handle: 'cove-2' }])).toBe(
            'cove-3'
        );
    });
});
