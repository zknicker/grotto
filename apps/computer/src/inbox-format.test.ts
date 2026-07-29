import { expect, test } from 'bun:test';
import { composeInboxDrain, composeInboxNotice } from './inbox-format.ts';
import type { HostedAgentInboxItem } from './launch.ts';

test('projects structured inbox rows into the specified drain envelope', () => {
    expect(
        composeInboxDrain([item({ senderDescription: 'Product owner' })], 'America/New_York')
    ).toBe(
        [
            'New message received:',
            '',
            '[target=#general msg=first time=2026-07-26 20:00:00 type=human] @zach — Product owner: Ship it',
            '',
            'Respond as appropriate. Complete all your work before stopping.',
            "Reply in the channel or create/reply in a thread as appropriate; use each message's `target` and `msg` fields to choose the exact target.",
        ].join('\n')
    );
});

test('uses a zero-based local wall clock at midnight', () => {
    expect(composeInboxDrain([item()], 'UTC')).toContain('time=2026-07-27 00:00:00 type=human');
});

test('busy notices include target metadata but never message bodies', () => {
    const notice = composeInboxNotice([
        item(),
        item({
            content: 'This must also stay hidden',
            id: 'msg_latest',
            sequence: 2,
            target: 'dm:@zach',
        }),
    ]);
    expect(notice).toContain('#general pending: 1 message(s) · first msg=first');
    expect(notice).toContain('dm:@zach pending: 1 message(s) · first msg=latest');
    expect(notice).toContain('· dm');
    expect(notice).not.toContain('Ship it');
    expect(notice).not.toContain('This must also stay hidden');
});

test('projects task and mention intent into both drain and busy-notice metadata', () => {
    const task = item({
        mentioned: true,
        task: {
            assigneeAgentId: null,
            assigneeUserId: null,
            messageId: 'msg_first',
            number: 7,
            priority: 'high',
            status: 'todo',
        },
    });

    expect(composeInboxDrain([task], 'UTC')).toContain(
        'type=human task=#7:todo:unassigned mentioned=true'
    );
    expect(composeInboxNotice([task])).toContain('· task #7 · you were mentioned');
});

function item(overrides: Partial<HostedAgentInboxItem> = {}): HostedAgentInboxItem {
    return {
        chatId: 'cht_general',
        content: 'Ship it',
        createdAt: '2026-07-27T00:00:00.000Z',
        id: 'msg_first',
        senderHandle: 'zach',
        senderType: 'human',
        sequence: 1,
        target: '#general',
        ...overrides,
    };
}
