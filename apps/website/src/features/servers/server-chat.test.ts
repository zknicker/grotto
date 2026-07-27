import { expect, test } from 'bun:test';
import type { HostedChatMessage } from '@tavern/api';
import { mergeTaskAnchor } from './server-chat.tsx';

test('keeps an older task anchor available when the latest transcript page omits it', () => {
    const anchor = message('message_anchor', 1);
    const latest = message('message_latest', 51);

    expect(mergeTaskAnchor([latest], anchor)).toEqual([anchor, latest]);
    expect(mergeTaskAnchor([anchor, latest], anchor)).toEqual([anchor, latest]);
});

function message(id: string, sequence: number): HostedChatMessage {
    return {
        authorUserId: 'user_one',
        chatId: 'chat_one',
        content: id,
        createdAt: '2026-07-26T12:00:00.000Z',
        id,
        nonce: `nonce_${id}`,
        sequence,
        serverId: 'server_one',
    };
}
