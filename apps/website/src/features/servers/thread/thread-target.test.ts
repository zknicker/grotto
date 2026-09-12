import { expect, test } from 'bun:test';
import { testChat } from '../../chats/chat-fixtures.ts';
import { humanDirectory } from '../human-identity.ts';
import { threadTitles } from './thread-target.ts';

const humans = humanDirectory([]);

test('Thread targets preserve non-canonical opaque anchor ids', () => {
    expect(
        threadTitles(
            testChat({
                id: 'cht_parent',
                isAll: true,
                lastMessageSequence: 1,
                name: 'all',
                serverId: 'srv_one',
            }),
            'msg_opaque-base64',
            humans
        )
    ).toEqual({
        context: '#all',
        header: 'Thread — #all',
        target: '#all:msg_opaque-base64',
    });
});
