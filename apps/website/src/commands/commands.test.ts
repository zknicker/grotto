import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatListItem } from '../features/chats/chat-list-data.ts';
import type { CapabilityView } from '../hooks/connections/use-capability.ts';
import { buildChatNavigationCommandGroups } from './chat-navigation-commands.ts';
import { buildCurrentChatCommandGroup, getCurrentChatId } from './current-chat-commands.ts';
import { buildDeveloperCommandGroup } from './developer-commands.ts';
import { buildNavigationCommandGroup } from './navigation-commands.ts';
import { buildSettingsCommandGroup } from './settings-commands.ts';
import type { AppCommandBuildContext } from './types.ts';

const healthyCapability: CapabilityView = {
    healthy: true,
    missingCapabilities: [],
    reason: null,
    state: 'healthy',
    status: null,
} as const;

function createContext(overrides: Partial<AppCommandBuildContext> = {}): AppCommandBuildContext {
    return {
        chats: [],
        currentChat: null,
        devMode: false,
        navigate: () => undefined,
        pathname: '/activity',
        resolveCapability: () => healthyCapability,
        setDevMode: () => undefined,
        ...overrides,
    };
}

test('global command groups expose the first slice of Grotto actions', () => {
    const context = createContext();
    const groups = [
        buildNavigationCommandGroup(context),
        buildSettingsCommandGroup(context),
        buildDeveloperCommandGroup(context),
    ];
    const commandTitles = groups.flatMap((group) => group.commands.map((command) => command.title));

    assert.deepEqual(
        groups.map((group) => group.title),
        ['Navigation', 'Settings', 'Developer']
    );
    assert.ok(commandTitles.includes('Search'));
    assert.ok(commandTitles.includes('Chat'));
    assert.ok(commandTitles.includes('Activity'));
    assert.ok(commandTitles.includes('Members'));
    assert.ok(commandTitles.includes('Turn Dev Mode On'));
});

test('chat navigation commands expose channels and direct messages', () => {
    const navigatedPaths: string[] = [];
    const context = createContext({
        chats: [
            createChat({
                conversationKind: 'channel',
                displayName: 'demo',
                id: 'cht_demo',
                searchText: 'demo channel tavern',
            }),
            createChat({
                conversationKind: 'direct',
                displayName: 'Tavern',
                id: 'cht_dm',
                searchText: 'tavern dm',
            }),
            createChat({
                conversationKind: 'group',
                displayName: 'Legacy group',
                id: 'cht_group',
                searchText: 'legacy group',
            }),
        ],
        navigate: (path) => {
            navigatedPaths.push(path);
        },
    });

    const groups = buildChatNavigationCommandGroups(context);

    assert.deepEqual(
        groups.map((group) => [group.title, group.commands.map((command) => command.title)]),
        [
            ['Channels', ['demo']],
            ['Direct Messages', ['Tavern']],
        ]
    );

    groups[0]?.commands[0]?.run();
    groups[1]?.commands[0]?.run();

    assert.deepEqual(navigatedPaths, ['/chats/cht_demo', '/chats/cht_dm']);
});

test('current chat commands only appear on chat routes', () => {
    assert.equal(getCurrentChatId('/overview'), null);
    assert.equal(getCurrentChatId('/chats/chat_123'), 'chat_123');
    assert.equal(getCurrentChatId('/chats/chat%20space'), 'chat space');
    assert.equal(buildCurrentChatCommandGroup(createContext({ pathname: '/overview' })), null);

    const group = buildCurrentChatCommandGroup(
        createContext({
            currentChat: {
                boundAgentIds: ['agt_primary'],
                id: 'chat_123',
                participants: [],
            } as unknown as AppCommandBuildContext['currentChat'],
            pathname: '/chats/chat_123',
        })
    );

    assert.equal(group?.title, 'Current Chat');
    assert.ok(group?.commands.some((command) => command.title === 'Focus Composer'));
    assert.ok(group?.commands.some((command) => command.title === 'Agent Profile'));
});

function createChat(overrides: Partial<ChatListItem> = {}): ChatListItem {
    return {
        agentRuntimeSync: null,
        agentRuntimeSyncLabel: null,
        archived: false,
        boundAgentIds: ['agt_primary'],
        description: null,
        canSend: true,
        conversationKind: 'channel',
        createdAt: '2026-07-07T12:00:00.000Z',
        displayName: 'demo',
        framework: 'tavern',
        activeTurnParticipantIds: [],
        unreadCount: 0,
        hasActivity: true,
        id: 'cht_demo',
        isDisabled: false,
        isEnabled: true,
        lastActivityAt: '2026-07-07T12:00:00.000Z',
        latestSession: null,
        participants: [],
        scope: 'channel',
        searchText: 'demo',
        sessionCount: 1,
        source: { kind: 'tavern', label: 'Tavern' },
        systemPrompt: null,
        tabAppearance: { color: null },
        targetParticipant: null,
        title: 'demo',
        type: 'tavern',
        ...overrides,
    };
}
