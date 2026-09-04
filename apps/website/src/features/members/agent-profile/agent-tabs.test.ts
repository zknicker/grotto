import { expect, test } from 'bun:test';
import { agentTabs, isAgentTab } from './agent-tabs.ts';

test('Reminders and Triggers share one routable Automations tab', () => {
    expect(isAgentTab('automations')).toBe(true);
    expect(isAgentTab('reminders')).toBe(false);
    expect(isAgentTab('triggers')).toBe(false);
});

// The Segment strip is a five-word budget; a sixth label overflows the
// chat-side profile pane. See the comment on `tabOptions` in agent-profile.tsx.
test('the profile tab strip stays within its five-word budget', () => {
    expect(agentTabs).toHaveLength(5);
});
