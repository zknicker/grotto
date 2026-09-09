import { expect, test } from 'bun:test';
import { agentTabs, isAgentTab } from './agent-tabs.ts';

test('Reminders and Triggers share one routable Automations tab', () => {
    expect(isAgentTab('automations')).toBe(true);
    expect(isAgentTab('reminders')).toBe(false);
    expect(isAgentTab('triggers')).toBe(false);
});

// Connections, Skills, identity, and execution configuration are one
// destination now, so the old `tools` path is gone rather than aliased.
test('configuration lives on Setup, and the old Tools path is not routable', () => {
    expect(isAgentTab('setup')).toBe(true);
    expect(isAgentTab('tools')).toBe(false);
});

test('the profile has one tab per section, in reading order', () => {
    expect([...agentTabs]).toEqual(['overview', 'setup', 'automations', 'activity', 'workspace']);
});
