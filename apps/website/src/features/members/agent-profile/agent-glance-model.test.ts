import { expect, test } from 'bun:test';
import {
    countAgentAutomations,
    countAgentSkills,
    formatAgentAutomations,
    grantedAgentConnections,
} from './agent-glance-model.ts';

test('the Automations count is what is still standing, not what has run', () => {
    const counts = countAgentAutomations(
        [{ status: 'scheduled' }, { status: 'fired' }, { status: 'scheduled' }],
        [{ status: 'armed' }, { status: 'disabled' }]
    );
    expect(counts).toEqual({ armedTriggers: 1, scheduledReminders: 2, total: 3 });
    expect(formatAgentAutomations(counts)).toBe('2 scheduled · 1 armed');
});

test('an Agent with no standing automations counts zero', () => {
    expect(countAgentAutomations([], [])).toEqual({
        armedTriggers: 0,
        scheduledReminders: 0,
        total: 0,
    });
});

test('Connections is only what this Agent can use right now', () => {
    const grants = [{ agentId: 'agt_1' }];
    const usable = { connected: true, grants, name: 'search', tools: [{ name: 'search' }] };
    const granted = grantedAgentConnections(
        [
            usable,
            // Granted but offline, so the Agent cannot call it.
            { connected: false, grants, name: 'offline', tools: [{ name: 'search' }] },
            // Connected but toolless, so there is nothing to call.
            { connected: true, grants, name: 'toolless', tools: [] },
            // Connected and useful, but granted to somebody else.
            {
                connected: true,
                grants: [{ agentId: 'agt_2' }],
                name: 'theirs',
                tools: [{ name: 'search' }],
            },
        ],
        'agt_1'
    );
    // One selector, so the tile's number and the peek's names are the same set.
    expect(granted).toEqual([usable]);
});

test('Skills counts the reporting Agent library, and zero without a report', () => {
    const agentSkills = [
        { agentId: 'agt_1', skills: [{ name: 'research' }, { name: 'writing' }] },
        { agentId: 'agt_2', skills: [{ name: 'research' }] },
    ];
    expect(countAgentSkills(agentSkills, 'agt_1')).toBe(2);
    expect(countAgentSkills(agentSkills, 'agt_missing')).toBe(0);
    expect(countAgentSkills(undefined, 'agt_1')).toBe(0);
});
