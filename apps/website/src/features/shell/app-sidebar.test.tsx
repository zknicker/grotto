import { expect, test } from 'bun:test';
import { Sidebar } from '@heroui-pro/react';
import type { Agent, Chat } from '@tavern/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ChatNavigation } from './chat-navigation.tsx';
import { ShellSidebar, ShellSidebarPage } from './shell-sidebar.tsx';

test('hides a retired Agent DM from active navigation', () => {
    const markup = renderToStaticMarkup(
        <MemoryRouter>
            <Sidebar.Provider>
                <ShellSidebar activePage="server">
                    <ShellSidebarPage ariaLabel="Server" value="server">
                        <ChatNavigation
                            agents={[]}
                            chats={[retiredDm()]}
                            onCreateChannel={() => undefined}
                            selectedChatId={undefined}
                            slug="tavern"
                        />
                    </ShellSidebarPage>
                </ShellSidebar>
            </Sidebar.Provider>
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
            <Sidebar.Provider>
                <ShellSidebar activePage="server">
                    <ShellSidebarPage ariaLabel="Server" value="server">
                        <ChatNavigation
                            agents={[blippy, tiny]}
                            chats={[dm('chat_blippy', blippy), dm('chat_tiny', tiny)]}
                            onCreateChannel={() => undefined}
                            selectedChatId="chat_blippy"
                            slug="tavern"
                        />
                    </ShellSidebarPage>
                </ShellSidebar>
            </Sidebar.Provider>
        </MemoryRouter>
    );

    expect(markup).toContain(`data-agent-id="${blippy.id}" data-agent-status="working"`);
    expect(markup).toContain(`data-agent-id="${tiny.id}" data-agent-status="idle"`);
    expect(markup).toContain('title="Working"');
    expect(markup).toContain('title="Online"');
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
        desiredRuntimeId: 'runtime_one',
        displayName: overrides.displayName,
        dmChatId: null,
        effectiveModelId: 'model_one',
        effectiveReportedAt: '2026-07-29T12:00:00.000Z',
        effectiveRuntimeId: 'runtime_one',
        factoryKind: 'ordinary',
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
        createdAt: '2026-07-29T12:00:00.000Z',
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
        createdAt: '2026-07-29T12:00:00.000Z',
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
