import { expect, test } from 'bun:test';
import { humanDirectory } from '../human-identity.ts';
import { threadTitles } from './thread-target.ts';

const humans = humanDirectory([]);

test('Thread targets preserve non-canonical opaque anchor ids', () => {
    expect(
        threadTitles(
            {
                archivedAt: null,
                archivedByUserId: null,
                color: null,
                createdAt: '2026-07-26T12:00:00.000Z',
                icon: null,
                id: 'cht_parent',
                isAll: true,
                kind: 'channel',
                lastActivityAt: null,
                lastMessageSequence: 1,
                name: 'all',
                participantAgentIds: [],
                participantUserIds: [],
                peerAgentDisplayName: null,
                peerAgentId: null,
                peerAgentRetired: false,
                peerUserId: null,
                serverId: 'srv_one',
                unreadCount: 0,
            },
            'msg_opaque-base64',
            humans
        )
    ).toEqual({
        header: 'Thread — #all',
        target: '#all:msg_opaque-base64',
    });
});
