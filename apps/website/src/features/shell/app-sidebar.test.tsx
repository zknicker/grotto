import { expect, test } from 'bun:test';
import { Sidebar } from '@heroui-pro/react';
import type { HostedChat } from '@tavern/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ChatNavigation } from './chat-navigation.tsx';
import { ShellSidebar, ShellSidebarPage } from './shell-sidebar.tsx';

test('keeps a retired Agent DM listed with its name and a Retired label', () => {
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

    expect(markup).toContain('Fen');
    expect(markup).toContain('Retired');
});

function retiredDm(): HostedChat {
    return {
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
