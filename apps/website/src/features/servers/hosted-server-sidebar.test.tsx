import { expect, test } from 'bun:test';
import type { HostedChat } from '@tavern/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SidebarProvider } from '../../components/ui/sidebar.tsx';
import { HostedServerSidebar } from './hosted-server-sidebar.tsx';

test('offers channel creation from the hosted Channels group', () => {
    const markup = renderToStaticMarkup(
        <MemoryRouter>
            <SidebarProvider>
                <HostedServerSidebar
                    agents={[]}
                    chats={[channel()]}
                    currentServer={{
                        displayName: 'Tavern',
                        id: 'server_one',
                        role: 'owner',
                        slug: 'tavern',
                    }}
                    onCreateChannel={() => undefined}
                    onOpenActivity={() => undefined}
                    onOpenChat={() => undefined}
                    selectedChatId={undefined}
                    servers={[]}
                />
            </SidebarProvider>
        </MemoryRouter>
    );

    expect(markup).toContain('aria-label="New channel"');
});

test('keeps a retired Agent DM listed with its name and a Retired label', () => {
    const markup = renderToStaticMarkup(
        <MemoryRouter>
            <SidebarProvider>
                <HostedServerSidebar
                    agents={[]}
                    chats={[retiredDm()]}
                    currentServer={{
                        displayName: 'Tavern',
                        id: 'server_one',
                        role: 'owner',
                        slug: 'tavern',
                    }}
                    onCreateChannel={() => undefined}
                    onOpenActivity={() => undefined}
                    onOpenChat={() => undefined}
                    selectedChatId={undefined}
                    servers={[]}
                />
            </SidebarProvider>
        </MemoryRouter>
    );

    expect(markup).toContain('Fen');
    expect(markup).toContain('Retired');
});

function channel(): HostedChat {
    return {
        createdAt: '2026-07-29T12:00:00.000Z',
        id: 'chat_product',
        isAll: false,
        kind: 'channel',
        lastActivityAt: null,
        lastMessageSequence: 0,
        name: 'product',
        participantUserIds: ['user_one'],
        peerAgentDisplayName: null,
        peerAgentId: null,
        peerAgentRetired: false,
        peerUserId: null,
        serverId: 'server_one',
        unreadCount: 0,
    };
}

function retiredDm(): HostedChat {
    return {
        createdAt: '2026-07-29T12:00:00.000Z',
        id: 'chat_fen',
        isAll: false,
        kind: 'dm',
        lastActivityAt: null,
        lastMessageSequence: 4,
        name: null,
        participantUserIds: ['user_one'],
        peerAgentDisplayName: 'Fen',
        peerAgentId: 'agt_fen0000000000000',
        peerAgentRetired: true,
        peerUserId: null,
        serverId: 'server_one',
        unreadCount: 0,
    };
}
