import { expect, test } from 'bun:test';
import { AgentRunSettlements } from './agent-run-settlements.ts';

test('settlement waiters resolve from run release without polling', async () => {
    const runs = new Map([['agt_1234567890123456', 'run_1234567890123456']]);
    const settlements = new AgentRunSettlements(runs);
    let settled = false;
    const waiting = settlements.wait('agt_1234567890123456').then(() => {
        settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    runs.delete('agt_1234567890123456');
    settlements.released('agt_1234567890123456');
    await waiting;
    expect(settled).toBe(true);
});
