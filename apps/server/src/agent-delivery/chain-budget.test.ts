import { expect, test } from 'bun:test';
import { canBeginAgentDrain, maxAgentChainTurns, nextAgentChainTurns } from './chain-budget.ts';

test('allows exactly sixteen consecutive agent-authored drain turns', () => {
    const agentRows = [{ source: 'agent:wren' }];
    expect(canBeginAgentDrain(agentRows, maxAgentChainTurns - 1)).toBe(true);
    expect(canBeginAgentDrain(agentRows, maxAgentChainTurns)).toBe(false);
});

test('human work resets the chain and remains dispatchable at the ceiling', () => {
    const humanRows = [{ source: 'human' }];
    expect(canBeginAgentDrain(humanRows, maxAgentChainTurns)).toBe(true);
    expect(nextAgentChainTurns(humanRows, maxAgentChainTurns)).toBe(0);
});

test('completed agent-authored drains spend one chain turn', () => {
    expect(nextAgentChainTurns([{ source: 'agent:wren' }], 7)).toBe(8);
});
