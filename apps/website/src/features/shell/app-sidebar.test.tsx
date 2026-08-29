import { expect, test } from 'bun:test';
import type { Agent, Chat } from '@grotto/api';
import { Sidebar } from '@heroui-pro/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ChatNavigation } from './chat-navigation.tsx';
import { CommandMenuProvider } from './command-menu-provider.tsx';
import { ShellSidebar, ShellSidebarPage } from './shell-sidebar.tsx';

test('hides a retired Agent DM from active navigation', () => {
    const markup = renderToStaticMarkup(
        <MemoryRouter>
            <CommandMenuProvider>
                <Sidebar.Provider>
                    <ShellSidebar activePage="server">
                        <ShellSidebarPage ariaLabel="Server" value="server">
                            <ChatNavigation
                                agents={[]}
                                chats={[retiredDm()]}
                                onCreateChannel={() => undefined}
                                onPreloadSection={() => undefined}
                                selectedChatId={undefined}
                                serverId="server_one"
                                slug="grotto"
                            />
                        </ShellSidebarPage>
                    </ShellSidebar>
                </Sidebar.Provider>
            </CommandMenuProvider>
        </MemoryRouter>
    );

    expect(markup).not.toContain('Fen');
    expect(markup).not.toContain('Retired');
});

test('renders each DM from its own Agent availability', () => {
    const blippy = agent({
        availability: 'working',
        displayName: 'Blippy',
        id: 'agt_blippy000000000',
    });
    const tiny = agent({
        availability: 'idle',
        displayName: 'Tiny',
        id: 'agt_tiny00000000000',
    });
    const markup = renderToStaticMarkup(
        <MemoryRouter>
            <CommandMenuProvider>
                <Sidebar.Provider>
                    <ShellSidebar activePage="server">
                        <ShellSidebarPage ariaLabel="Server" value="server">
                            <ChatNavigation
                                agents={[blippy, tiny]}
                                chats={[dm('chat_blippy', blippy), dm('chat_tiny', tiny)]}
                                onCreateChannel={() => undefined}
                                onPreloadSection={() => undefined}
                                selectedChatId="chat_blippy"
                                serverId="server_one"
                                slug="grotto"
                            />
                        </ShellSidebarPage>
                    </ShellSidebar>
                </Sidebar.Provider>
            </CommandMenuProvider>
        </MemoryRouter>
    );

    expect(markup).toContain(`data-agent-id="${blippy.id}" data-agent-status="working"`);
    expect(markup).toContain(`data-agent-id="${tiny.id}" data-agent-status="idle"`);
    expect(markup).toContain('title="Working"');
    expect(markup).toContain('title="Online"');
});

test('renders an active Agent as an implicit DM without a Chat row', () => {
    const blippy = agent({
        availability: 'idle',
        displayName: 'Blippy',
        id: 'agt_blippy000000000',
    });
    const markup = renderToStaticMarkup(
        <MemoryRouter>
            <CommandMenuProvider>
                <Sidebar.Provider>
                    <ShellSidebar activePage="server">
                        <ShellSidebarPage ariaLabel="Server" value="server">
                            <ChatNavigation
                                agents={[blippy]}
                                chats={[]}
                                onCreateChannel={() => undefined}
                                onPreloadSection={() => undefined}
                                selectedAgentDmId={blippy.id}
                                selectedChatId={undefined}
                                serverId="server_one"
                                slug="grotto"
                            />
                        </ShellSidebarPage>
                    </ShellSidebar>
                </Sidebar.Provider>
            </CommandMenuProvider>
        </MemoryRouter>
    );

    expect(markup).toContain('Blippy');
    expect(markup).toContain(`/s/grotto/dm/${blippy.id}`);
    expect(markup.match(/Blippy/g)?.length).toBeGreaterThan(0);
});

test('renders a draggable channel row with its chosen color and no handle', () => {
    const markup = renderToStaticMarkup(
        <MemoryRouter>
            <CommandMenuProvider>
                <Sidebar.Provider>
                    <ShellSidebar activePage="server">
                        <ShellSidebarPage ariaLabel="Server" value="server">
                            <ChatNavigation
                                agents={[]}
                                chats={[channel()]}
                                onCreateChannel={() => undefined}
                                onPreloadSection={() => undefined}
                                selectedChatId={undefined}
                                serverId="server_one"
                                slug="grotto"
                            />
                        </ShellSidebarPage>
                    </ShellSidebar>
                </Sidebar.Provider>
            </CommandMenuProvider>
        </MemoryRouter>
    );

    expect(markup).toContain('sortable-channel-row');
    expect(markup).not.toContain('Reorder');
    expect(markup).toContain('--channel-color-light:#7c3aed');
    expect(markup).toContain('--channel-color-dark:#a78bfa');
});

test('keeps context-menu chat rows on the stock Sidebar icon gap', () => {
    const blippy = agent({
        availability: 'idle',
        displayName: 'Blippy',
        id: 'agt_blippy000000000',
    });
    const markup = renderToStaticMarkup(
        <MemoryRouter>
            <CommandMenuProvider>
                <Sidebar.Provider>
                    <ShellSidebar activePage="server">
                        <ShellSidebarPage ariaLabel="Server" value="server">
                            <ChatNavigation
                                agents={[blippy]}
                                chats={[channel(), dm('chat_blippy', blippy)]}
                                onCreateChannel={() => undefined}
                                onPreloadSection={() => undefined}
                                selectedChatId={undefined}
                                serverId="server_one"
                                slug="grotto"
                            />
                        </ShellSidebarPage>
                    </ShellSidebar>
                </Sidebar.Provider>
            </CommandMenuProvider>
        </MemoryRouter>
    );
    const rowTriggers = markup.match(
        /context-menu__trigger flex min-w-0 flex-1 items-center gap-3/g
    );

    expect(rowTriggers).toHaveLength(2);
    expect(markup).not.toContain('context-menu__trigger flex min-w-0 flex-1 items-center gap-2');
});

test('keeps unread count chips circular until the number needs a pill', () => {
    const markup = renderToStaticMarkup(
        <MemoryRouter>
            <CommandMenuProvider>
                <Sidebar.Provider>
                    <ShellSidebar activePage="server">
                        <ShellSidebarPage ariaLabel="Server" value="server">
                            <ChatNavigation
                                agents={[]}
                                chats={[
                                    channel({ id: 'chat_one', unreadCount: 1 }),
                                    channel({ id: 'chat_ten', unreadCount: 10 }),
                                ]}
                                onCreateChannel={() => undefined}
                                onPreloadSection={() => undefined}
                                selectedChatId={undefined}
                                serverId="server_one"
                                slug="grotto"
                            />
                        </ShellSidebarPage>
                    </ShellSidebar>
                </Sidebar.Provider>
            </CommandMenuProvider>
        </MemoryRouter>
    );

    expect(markup).toContain('aria-label="1 unread"');
    expect(markup).toContain('aria-label="10 unread"');
    expect(markup).toContain('min-w-5 justify-center tabular-nums');
});

function agent(overrides: Pick<Agent, 'availability' | 'displayName' | 'id'>): Agent {
    return {
        availability: overrides.availability,
        avatarUrl: null,
        computerId: 'cmp_one',
        createdAt: '2026-07-29T12:00:00.000Z',
        createdByUserId: 'user_one',
        description: null,
        desiredModelId: 'model_one',
        desiredReasoningEffort: 'medium',
        desiredRuntimeId: 'runtime_one',
        displayName: overrides.displayName,
        dmChatId: null,
        effectiveModelId: 'model_one',
        effectiveReasoningEffort: 'medium',
        effectiveReportedAt: '2026-07-29T12:00:00.000Z',
        effectiveRuntimeId: 'runtime_one',
        factoryKind: 'ordinary',
        grottoAgent: {
            appliedAt: '2026-07-29T12:00:00.000Z',
            appliedVersion: '1.0.0',
            currentVersion: '1.0.0',
            status: 'current',
        },
        handle: overrides.displayName.toLowerCase(),
        id: overrides.id,
        missingResources: [],
        role: 'member',
        serverId: 'server_one',
        status: 'applied',
    };
}

function dm(id: string, peer: Agent): Chat {
    return {
        archivedAt: null,
        archivedByUserId: null,
        color: null,
        createdAt: '2026-07-29T12:00:00.000Z',
        icon: null,
        id,
        isAll: false,
        kind: 'dm',
        lastActivityAt: null,
        lastMessageSequence: 0,
        name: null,
        participantAgentIds: [peer.id],
        participantUserIds: ['user_one'],
        peerAgentDisplayName: peer.displayName,
        peerAgentId: peer.id,
        peerAgentRetired: false,
        peerUserId: null,
        serverId: 'server_one',
        unreadCount: 0,
    };
}

function retiredDm(): Chat {
    return {
        archivedAt: null,
        archivedByUserId: null,
        color: null,
        createdAt: '2026-07-29T12:00:00.000Z',
        icon: null,
        id: 'chat_fen',
        isAll: false,
        kind: 'dm',
        lastActivityAt: null,
        lastMessageSequence: 4,
        name: null,
        participantAgentIds: [],
        participantUserIds: ['user_one'],
        peerAgentDisplayName: 'Fen',
        peerAgentId: 'agt_fen0000000000000',
        peerAgentRetired: true,
        peerUserId: null,
        serverId: 'server_one',
        unreadCount: 0,
    };
}

function channel(overrides: Partial<Pick<Chat, 'id' | 'unreadCount'>> = {}): Chat {
    return {
        archivedAt: null,
        archivedByUserId: null,
        color: 'violet',
        createdAt: '2026-07-29T12:00:00.000Z',
        icon: 'RocketIcon',
        id: overrides.id ?? 'chat_planning',
        isAll: false,
        kind: 'channel',
        lastActivityAt: null,
        lastMessageSequence: 0,
        name: 'planning',
        participantAgentIds: [],
        participantUserIds: ['user_one'],
        peerAgentDisplayName: null,
        peerAgentId: null,
        peerAgentRetired: false,
        peerUserId: null,
        serverId: 'server_one',
        unreadCount: overrides.unreadCount ?? 0,
    };
}
