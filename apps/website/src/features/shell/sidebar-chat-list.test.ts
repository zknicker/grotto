import { describe, expect, test } from 'bun:test';
import type { ChatListItem } from '../chats/chat-list-data.ts';
import {
    buildSidebarChatGroups,
    buildSidebarChatList,
    formatSidebarActivityLabel,
    getSidebarChatTitle,
    hasLocalActiveTurn,
    isSidebarTavernChat,
    resolveCurrentChatId,
    resolveNavigableActivityChatId,
    selectMostRecentChatRailConversation,
} from './sidebar-chat-list-model.ts';

function createChat(overrides: Partial<ChatListItem> = {}): ChatListItem {
    return {
        agentRuntimeSync: null,
        agentRuntimeSyncLabel: null,
        archived: false,
        boundAgentIds: ['agent-1'],
        canSend: true,
        conversationKind: 'group',
        createdAt: '2026-05-01T12:00:00.000Z',
        description: null,
        displayName: 'Tavern chat',
        framework: 'tavern',
        activeTurnParticipantIds: [],
        unreadCount: 0,
        hasActivity: true,
        id: 'chat-1',
        isDisabled: false,
        isEnabled: true,
        lastActivityAt: '2026-05-06T12:00:00.000Z',
        latestSession: {
            agentId: 'agent-1',
            sessionId: null,
            lastActivityAt: '2026-05-06T12:00:00.000Z',
            platform: 'tavern',
            sessionKey: 'session-1',
            title: null,
        },
        participants: [],
        scope: null,
        searchText: 'tavern chat',
        sessionCount: 1,
        source: { kind: 'tavern', label: 'Tavern' },
        systemPrompt: null,
        tabAppearance: { color: null },
        targetParticipant: null,
        title: 'Tavern chat',
        type: 'tavern',
        ...overrides,
    };
}

describe('sidebar chat list', () => {
    test('keeps only Tavern-initiated chats', () => {
        expect(isSidebarTavernChat(createChat())).toBeTrue();
        expect(isSidebarTavernChat(createChat({ framework: 'agentRuntime' }))).toBeFalse();
        expect(isSidebarTavernChat(createChat({ type: 'discord' }))).toBeFalse();
    });

    test('keeps recent Tavern chats in list order', () => {
        const chats = [
            createChat({ id: 'discord', framework: 'agentRuntime', type: 'discord' }),
            createChat({ id: 'tavern' }),
        ];

        expect(buildSidebarChatList(chats)).toEqual([chats[1]]);
    });

    test('groups channel chats as durable channels', () => {
        const general = createChat({ conversationKind: 'channel', id: 'general' });
        const planning = createChat({ conversationKind: 'channel', id: 'planning' });
        const groups = buildSidebarChatGroups([general, planning]);

        expect(groups.channels).toEqual([general, planning]);
        expect(groups.directMessages).toEqual([]);
        expect(groups.recentChats).toEqual([general, planning]);
        expect(groups.allChats).toEqual([general, planning]);
    });

    test('splits workspace chats into channels and direct messages', () => {
        const channel = createChat({
            conversationKind: 'channel',
            id: 'channel',
            title: '#general',
        });
        const dm = createChat({
            conversationKind: 'direct',
            id: 'dm',
            title: 'Tavern',
        });
        const group = createChat({
            conversationKind: 'group',
            id: 'group',
            title: 'Legacy group',
        });

        const groups = buildSidebarChatGroups([channel, dm, group]);

        expect(groups.channels).toEqual([channel]);
        expect(groups.directMessages).toEqual([dm]);
        expect(groups.recentChats).toEqual([channel, dm, group]);
    });

    test('selects the newest visible Chat rail conversation', () => {
        const channel = createChat({
            conversationKind: 'channel',
            id: 'channel',
            lastActivityAt: '2026-05-06T12:00:00.000Z',
        });
        const direct = createChat({
            conversationKind: 'direct',
            id: 'direct',
            lastActivityAt: '2026-05-07T12:00:00.000Z',
        });
        const task = createChat({
            conversationKind: 'task',
            id: 'task',
            lastActivityAt: '2026-05-08T12:00:00.000Z',
        });

        expect(selectMostRecentChatRailConversation([task, channel, direct])).toBe(direct);
    });

    test('navigates activity only when its chat is in the first-party list', () => {
        const chat = createChat({ id: 'chat-1' });

        expect(resolveNavigableActivityChatId('chat-1', [chat])).toBe('chat-1');
        expect(resolveNavigableActivityChatId('external-chat', [chat])).toBeNull();
        expect(resolveNavigableActivityChatId(null, [chat])).toBeNull();
    });

    test('resolves the current chat from the leaf URL outside its route context', () => {
        expect(resolveCurrentChatId('/chats/chat-1')).toBe('chat-1');
        expect(resolveCurrentChatId('/chats/archived')).toBeNull();
        expect(resolveCurrentChatId('/activity')).toBeNull();
    });

    test('shortens sidebar activity labels', () => {
        expect(formatSidebarActivityLabel('33m ago')).toBe('33m');
        expect(formatSidebarActivityLabel('2h ago')).toBe('2h');
        expect(formatSidebarActivityLabel('just now')).toBe('just now');
        expect(formatSidebarActivityLabel('no activity yet')).toBe('no activity yet');
    });

    test('shows the chat name without the Tavern prefix', () => {
        expect(
            getSidebarChatTitle(
                createChat({
                    description: null,
                    displayName: 'Hey Blippy!',
                    title: 'Tavern Hey Blippy!',
                })
            )
        ).toBe('Hey Blippy!');
    });

    test('uses explicit active turn state for local sidebar progress', () => {
        expect(hasLocalActiveTurn({ activeTurns: [] })).toBeFalse();
        expect(
            hasLocalActiveTurn({
                activeTurns: [
                    {
                        agentId: 'agent-1',
                        chatId: 'chat-1',
                        runId: 'run-1',
                        sessionKey: 'session-1',
                        startedAt: '2026-05-06T12:00:00.000Z',
                    },
                ],
            })
        ).toBeTrue();
    });
});
