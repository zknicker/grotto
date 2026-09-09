import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TaskItem } from '../tasks/task-model.ts';
import { NeedsYouStalledClaimList } from './needs-you-stalled-claim-list.tsx';

test('a stopped claim names its Agent and states what was asked', () => {
    const markup = renderToStaticMarkup(
        <NeedsYouStalledClaimList claims={[stalledClaim()]} onOpenTask={() => undefined} />
    );

    expect(markup).toContain('Blippy stopped before finishing');
    expect(markup).toContain('Rename the deploy script');
    expect(markup).toContain('Task #4');
});

function stalledClaim(): TaskItem {
    return {
        assigneeAgentId: 'agt_blippy',
        assigneeAvatarUrl: null,
        assigneeLabel: 'Blippy',
        assigneeUserId: null,
        chatId: 'cht_all',
        chatLabel: '#all',
        claimedAt: '2026-09-08T12:00:00.000Z',
        createdAt: '2026-09-08T12:00:00.000Z',
        createdByUserId: 'usr_ada',
        id: 'msg_1',
        labels: [],
        live: false,
        message: { content: 'Rename the deploy script', id: 'msg_1' } as TaskItem['message'],
        number: 4,
        origin: 'claimed',
        priority: 'none',
        status: 'in_progress',
        threadChatId: 'cht_thr_msg_1',
        threadSummary: {
            anchorMessageId: 'msg_1',
            followed: false,
            latestReplyAt: null,
            recentReplies: [],
            replyCount: 0,
            threadChatId: 'cht_thr_msg_1',
            unreadCount: 0,
        },
        tier: 'tracked',
        title: 'Rename the deploy script',
        updatedAt: '2026-09-08T12:00:20.000Z',
        version: 1,
    };
}
