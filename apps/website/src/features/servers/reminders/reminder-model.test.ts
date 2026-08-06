import { expect, test } from 'bun:test';
import { filterReminders, toReminderItem } from './reminder-model.ts';

const reminder = {
    anchorChatId: 'cht_all',
    anchorMessageId: 'msg_anchor',
    createdAt: '2026-07-26T12:00:00.000Z',
    fireAt: '2026-07-27T13:00:00.000Z',
    hasScript: true,
    id: 'rem_one',
    ownerAgentId: 'agt_cove',
    ownerHandle: 'Cove',
    repeat: 'daily@09:00',
    scriptBytes: 12,
    status: 'scheduled' as const,
    timezone: 'America/New_York',
    title: 'Check health',
    updatedAt: '2026-07-26T12:00:00.000Z',
    version: 1,
};

test('builds a script-redacted hosted reminder row', () => {
    const item = toReminderItem(reminder);

    expect(item).toMatchObject({
        isScript: true,
        ownerLabel: '@Cove',
        scriptLabel: 'Script · 12 bytes · local execution only',
        status: 'scheduled',
        title: 'Check health',
    });
    expect(JSON.stringify(item)).not.toContain('script:');
});

test('filters hosted reminders by Agent, status, and text', () => {
    const canceled = {
        ...reminder,
        id: 'rem_two',
        ownerAgentId: 'agt_reef',
        ownerHandle: 'Reef',
        status: 'canceled' as const,
        title: 'Archive report',
    };

    expect(
        filterReminders([reminder, canceled], {
            agentId: 'agt_cove',
            query: 'health',
            status: 'scheduled',
        })
    ).toEqual([reminder]);
    expect(
        filterReminders([reminder, canceled], {
            agentId: null,
            query: 'reef',
            status: 'all',
        })
    ).toEqual([canceled]);
});
