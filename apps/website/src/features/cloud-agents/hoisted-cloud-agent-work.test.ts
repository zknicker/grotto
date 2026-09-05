import { expect, test } from 'bun:test';
import type { ActiveCloudAgentWork, ChatMessage, CloudAgentWork } from '@grotto/api';
import { indexCloudAgentWorkByThreadAnchor } from './hoisted-cloud-agent-work.ts';

test('work delegated inside a Thread indexes under that Thread’s anchor', () => {
    const index = indexCloudAgentWorkByThreadAnchor([
        activeWork({ anchorMessageId: 'msg_task', workId: 'caw_one', workMessageId: 'msg_reply' }),
    ]);

    expect(index.get('msg_task')?.id).toBe('caw_one');
});

test('work whose own Message anchors the Thread never hoists onto itself', () => {
    const index = indexCloudAgentWorkByThreadAnchor([
        activeWork({ anchorMessageId: null, workId: 'caw_one', workMessageId: 'msg_work' }),
    ]);

    expect(index.size).toBe(0);
});

test('the first live work under an anchor is the one the surface states', () => {
    const index = indexCloudAgentWorkByThreadAnchor([
        activeWork({ anchorMessageId: 'msg_task', workId: 'caw_one', workMessageId: 'msg_a' }),
        activeWork({ anchorMessageId: 'msg_task', workId: 'caw_two', workMessageId: 'msg_b' }),
    ]);

    expect(index.get('msg_task')?.id).toBe('caw_one');
});

test('a list that has not loaded yet hoists nothing', () => {
    expect(indexCloudAgentWorkByThreadAnchor(undefined).size).toBe(0);
});

function activeWork(input: {
    anchorMessageId: null | string;
    workId: string;
    workMessageId: string;
}): ActiveCloudAgentWork {
    return {
        chatKind: 'channel',
        chatName: 'all',
        chatPeerUserId: null,
        conversationChatId: 'cht_parent',
        message: message(input.workMessageId),
        threadAnchorMessage: input.anchorMessageId ? message(input.anchorMessageId) : null,
        threadChatId: 'cht_thread',
        work: { id: input.workId, messageId: input.workMessageId } as CloudAgentWork,
    };
}

function message(id: string): ChatMessage {
    return { id } as ChatMessage;
}
