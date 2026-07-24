import { expect, test } from 'bun:test';
import { createNewAgentName } from './create-agent-name.ts';

function agent(name: string) {
    return { name } as Parameters<typeof createNewAgentName>[0][number];
}

test('uses the base name when free', () => {
    expect(createNewAgentName([agent('Scout')])).toBe('new-agent');
});

test('suffixes past existing new agents, case-insensitively', () => {
    expect(createNewAgentName([agent('new-agent'), agent('NEW-AGENT-2')])).toBe('new-agent-3');
});

test('unique-suffixes archetype handles the same way', () => {
    expect(createNewAgentName([agent('Scout')], 'analyst')).toBe('analyst');
    expect(createNewAgentName([agent('analyst')], 'analyst')).toBe('analyst-2');
});

test('collision checks are case-insensitive; the proposal keeps its casing', () => {
    // Handles are case-insensitively unique (W1): a roster Cove must push
    // the Cove proposal to Cove-2, not retry the occupied handle.
    expect(createNewAgentName([agent('cove')], 'Cove')).toBe('Cove-2');
    expect(createNewAgentName([agent('Cove'), agent('COVE-2')], 'Cove')).toBe('Cove-3');
});
