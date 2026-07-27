import { expect, test } from 'bun:test';
import type { HostedChatMessage } from '@tavern/api';
import { mergeHostedThreadMessagePages } from './use-server-thread-messages.ts';

test('Thread pages merge oldest-first without duplicate messages', () => {
    expect(
        mergeHostedThreadMessagePages([
            { messages: [message('msg_new', 3)] },
            { messages: [message('msg_old', 1), message('msg_middle', 2)] },
        ]).map(({ id }) => id)
    ).toEqual(['msg_old', 'msg_middle', 'msg_new']);
});

function message(id: string, sequence: number): HostedChatMessage {
    return {
        author: { kind: 'human', userId: 'usr_author' },
        chatId: 'cht_thread',
        content: id,
        createdAt: '2026-07-26T12:00:00.000Z',
        id,
        nonce: `nonce_${id}`,
        sequence,
        serverId: 'srv_one',
    };
}
