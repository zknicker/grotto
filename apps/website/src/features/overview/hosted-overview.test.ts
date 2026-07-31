import { expect, test } from 'bun:test';
import type { HostedAgent, HostedChat } from '@tavern/api';
import { buildHostedOverviewActivity, toOverviewAgent } from './hosted-overview.tsx';

const hostedAgent = {
    archetype: null,
    availability: 'idle',
    character: 'robot',
    computerId: 'computer-1',
    createdAt: '2026-07-28T12:00:00-04:00',
    description: null,
    desiredModelId: 'gpt-5.6-sol',
    desiredRuntimeId: 'codex',
    displayName: 'Otto',
    dmChatId: 'chat-dm',
    effectiveModelId: 'gpt-5.6-sol',
    effectiveReportedAt: '2026-07-28T12:00:00-04:00',
    effectiveRuntimeId: 'codex',
    handle: 'otto',
    id: 'agent-1',
    missingResources: [],
    role: 'member',
    serverId: 'server-1',
    status: 'applied',
} satisfies HostedAgent;

test('hosted agents map into the preserved Overview presentation model', () => {
    expect(toOverviewAgent(hostedAgent)).toMatchObject({
        effectiveCharacter: 'robot',
        effectivePrimaryColor: null,
        id: 'agent-1',
        name: 'Otto',
    });
});

test('hosted chat activity maps to ordered Server-scoped Overview rows', () => {
    const chats = [
        hostedChat({
            id: 'older/chat',
            kind: 'dm',
            lastActivityAt: '2026-07-28T12:00:00-04:00',
            name: null,
            peerAgentId: 'agent-1',
        }),
        hostedChat({
            id: 'newer chat',
            kind: 'channel',
            lastActivityAt: '2026-07-28T12:05:00-04:00',
            name: 'product',
            peerAgentId: null,
        }),
    ];

    expect(buildHostedOverviewActivity(chats, 'dev')).toEqual([
        expect.objectContaining({
            agentId: null,
            description: '#product had new activity',
            href: '/s/dev/chats/newer%20chat',
            key: 'newer chat',
        }),
        expect.objectContaining({
            agentId: 'agent-1',
            description: 'Direct message had new activity',
            href: '/s/dev/chats/older%2Fchat',
            key: 'older/chat',
        }),
    ]);
});

function hostedChat(
    input: Pick<HostedChat, 'id' | 'kind' | 'lastActivityAt' | 'name' | 'peerAgentId'>
): HostedChat {
    return {
        createdAt: '2026-07-28T11:00:00-04:00',
        id: input.id,
        isAll: false,
        kind: input.kind,
        lastActivityAt: input.lastActivityAt,
        lastMessageSequence: 1,
        name: input.name,
        participantUserIds: [],
        peerAgentDisplayName: null,
        peerAgentId: input.peerAgentId,
        peerAgentRetired: false,
        peerUserId: null,
        serverId: 'server-1',
        unreadCount: 0,
    };
}
