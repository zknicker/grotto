import { Button } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { Plus } from '@hugeicons/core-free-icons';
import { ArchiveIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { Agent, Chat } from '@tavern/api';
import type React from 'react';
import { useLocation } from 'react-router-dom';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { AgentAvatar } from '../members/agent-avatar.tsx';
import { serverArchivedChatsRoute, serverChatRoute } from '../servers/server-routes.ts';
import { ShellSidebarPageContent } from './shell-sidebar.tsx';

export function ChatNavigation({
    agents,
    chats,
    onCreateChannel,
    selectedChatId,
    slug,
}: {
    agents: Agent[];
    chats: Chat[];
    onCreateChannel: () => void;
    selectedChatId: string | undefined;
    slug: string;
}) {
    const location = useLocation();
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const channels = chats.filter((chat) => chat.kind === 'channel');
    const directMessages = chats.filter((chat) => chat.kind === 'dm' && !chat.peerAgentRetired);

    return (
        <ShellSidebarPageContent band={<ChatNavigationBand onCreateChannel={onCreateChannel} />}>
            <ChatGroup
                agents={agentById}
                chats={channels}
                label="Channels"
                selectedChatId={selectedChatId}
                showLabel={false}
                slug={slug}
            />
            <ChatGroup
                agents={agentById}
                chats={directMessages}
                label="Direct messages"
                selectedChatId={selectedChatId}
                slug={slug}
            >
                <Sidebar.MenuItem
                    href={serverArchivedChatsRoute(slug)}
                    id="archived"
                    isCurrent={location.pathname === serverArchivedChatsRoute(slug)}
                    textValue="Archived"
                >
                    <Sidebar.MenuIcon>
                        <Icon aria-hidden="true" icon={ArchiveIcon} />
                    </Sidebar.MenuIcon>
                    <Sidebar.MenuItemContent>
                        <Sidebar.MenuLabel>Archived</Sidebar.MenuLabel>
                    </Sidebar.MenuItemContent>
                </Sidebar.MenuItem>
            </ChatGroup>
        </ShellSidebarPageContent>
    );
}

function ChatNavigationBand({ onCreateChannel }: { onCreateChannel: () => void }) {
    return (
        <div className="flex w-full items-center justify-between">
            <Sidebar.GroupLabel>Channels</Sidebar.GroupLabel>
            <Button
                aria-label="New channel"
                isIconOnly
                onPress={onCreateChannel}
                size="sm"
                variant="ghost"
            >
                <Icon aria-hidden="true" icon={Plus} size={16} />
            </Button>
        </div>
    );
}

function ChatGroup({
    agents,
    chats,
    children,
    label,
    selectedChatId,
    showLabel = true,
    slug,
}: {
    agents: Map<string, Agent>;
    chats: Chat[];
    children?: React.ReactNode;
    label: string;
    selectedChatId: string | undefined;
    showLabel?: boolean;
    slug: string;
}) {
    return (
        <Sidebar.Group>
            {showLabel ? <Sidebar.GroupLabel>{label}</Sidebar.GroupLabel> : null}
            <Sidebar.Menu aria-label={label}>
                {chats.map((chat) => {
                    const agent = chat.peerAgentId ? (agents.get(chat.peerAgentId) ?? null) : null;
                    const name =
                        chat.kind === 'channel'
                            ? (chat.name ?? 'channel')
                            : (agent?.displayName ?? chat.peerAgentDisplayName ?? 'Direct message');
                    return (
                        <Sidebar.MenuItem
                            href={serverChatRoute(slug, chat.id)}
                            id={chat.id}
                            isCurrent={chat.id === selectedChatId}
                            key={chat.id}
                            textValue={name}
                        >
                            <Sidebar.MenuIcon>
                                <ChatIcon agent={agent} />
                            </Sidebar.MenuIcon>
                            <Sidebar.MenuItemContent>
                                <Sidebar.MenuLabel>{name}</Sidebar.MenuLabel>
                                {chat.unreadCount > 0 ? (
                                    <Sidebar.MenuChip>{chat.unreadCount}</Sidebar.MenuChip>
                                ) : null}
                            </Sidebar.MenuItemContent>
                        </Sidebar.MenuItem>
                    );
                })}
                {children}
            </Sidebar.Menu>
        </Sidebar.Group>
    );
}

function ChatIcon({ agent }: { agent: Agent | null }) {
    if (!agent) {
        return <ChannelIconBox size="sidebar" />;
    }

    return <AgentAvatar agent={agent} size={24} />;
}
