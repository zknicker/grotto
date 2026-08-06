import { Button } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { Plus } from '@hugeicons/core-free-icons';
import { ArchiveIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent, HostedChat } from '@tavern/api';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { AgentAvatar } from '../members/agent-avatar.tsx';
import { serverChatRoute } from '../servers/server-routes.ts';
import { ShellSidebarPageContent } from './shell-sidebar.tsx';
import { SidebarAccount } from './sidebar-account.tsx';

export function ChatNavigation({
    agents,
    chats,
    onCreateChannel,
    selectedChatId,
    slug,
}: {
    agents: HostedAgent[];
    chats: HostedChat[];
    onCreateChannel: () => void;
    selectedChatId: string | undefined;
    slug: string;
}) {
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const channels = chats.filter((chat) => chat.kind === 'channel');
    const directMessages = chats.filter((chat) => chat.kind === 'dm');

    return (
        <ShellSidebarPageContent
            band={
                <div className="flex w-full items-center justify-between pe-1">
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
            }
            footer={<SidebarAccount />}
        >
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
            />
            <Sidebar.Menu aria-label="Archive">
                <Sidebar.MenuItem id="archived" textValue="Archived">
                    <Sidebar.MenuIcon>
                        <Icon aria-hidden="true" icon={ArchiveIcon} />
                    </Sidebar.MenuIcon>
                    <Sidebar.MenuItemContent>
                        <Sidebar.MenuLabel>Archived</Sidebar.MenuLabel>
                    </Sidebar.MenuItemContent>
                </Sidebar.MenuItem>
            </Sidebar.Menu>
        </ShellSidebarPageContent>
    );
}

function ChatGroup({
    agents,
    chats,
    label,
    selectedChatId,
    showLabel = true,
    slug,
}: {
    agents: Map<string, HostedAgent>;
    chats: HostedChat[];
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
                                {chat.peerAgentRetired ? (
                                    <Sidebar.MenuChip>Retired</Sidebar.MenuChip>
                                ) : null}
                                {chat.unreadCount > 0 ? (
                                    <Sidebar.MenuChip>{chat.unreadCount}</Sidebar.MenuChip>
                                ) : null}
                            </Sidebar.MenuItemContent>
                        </Sidebar.MenuItem>
                    );
                })}
            </Sidebar.Menu>
        </Sidebar.Group>
    );
}

function ChatIcon({ agent }: { agent: HostedAgent | null }) {
    if (!agent) {
        return <ChannelIconBox size="sidebar" />;
    }

    return <AgentAvatar agent={agent} />;
}
