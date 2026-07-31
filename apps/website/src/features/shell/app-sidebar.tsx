import { Plus } from '@hugeicons/core-free-icons';
import { Activity03Icon, ArchiveIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Button } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import type { HostedAgent, HostedChat } from '@tavern/api';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { StatusDot, type StatusDotProps } from '../../components/ui/status-dot.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { HostedAgentFace } from '../members/hosted-agent-face.tsx';
import { serverActivityRoute, serverChatRoute } from '../servers/server-routes.ts';
import { SidebarAccount } from './sidebar-account.tsx';

/** Contextual sidebar for the server: activity, channels, and DMs. */
export function AppSidebar({
    agents,
    chats,
    currentServer,
    onCreateChannel,
    selectedChatId,
}: {
    agents: HostedAgent[];
    chats: HostedChat[];
    currentServer: ServerSummary;
    onCreateChannel: () => void;
    selectedChatId: string | undefined;
}) {
    const slug = currentServer.slug;
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const channels = chats.filter((chat) => chat.kind === 'channel');
    const directMessages = chats.filter((chat) => chat.kind === 'dm');

    return (
        <Sidebar aria-label="Server">
            <Sidebar.Header>
                <div className="min-w-0 px-2 py-1">
                    <span className="block truncate font-semibold text-sm">
                        {currentServer.displayName}
                    </span>
                    <span className="block truncate text-muted text-xs">/{slug}</span>
                </div>
            </Sidebar.Header>
            <Sidebar.Content>
                <Sidebar.Menu aria-label="Server home">
                    <Sidebar.MenuItem
                        href={serverActivityRoute(slug)}
                        id="activity"
                        textValue="Activity"
                    >
                        <Sidebar.MenuIcon>
                            <Icon aria-hidden="true" icon={Activity03Icon} />
                        </Sidebar.MenuIcon>
                        <Sidebar.MenuItemContent>
                            <Sidebar.MenuLabel>Activity</Sidebar.MenuLabel>
                        </Sidebar.MenuItemContent>
                    </Sidebar.MenuItem>
                </Sidebar.Menu>
                <ChatGroup
                    action={
                        <Button
                            aria-label="New channel"
                            isIconOnly
                            onPress={onCreateChannel}
                            size="sm"
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" icon={Plus} size={16} />
                        </Button>
                    }
                    agents={agentById}
                    chats={channels}
                    label="Channels"
                    selectedChatId={selectedChatId}
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
            </Sidebar.Content>
            <Sidebar.Footer>
                <SidebarAccount />
            </Sidebar.Footer>
        </Sidebar>
    );
}

function ChatGroup({
    action,
    agents,
    chats,
    label,
    selectedChatId,
    slug,
}: {
    action?: React.ReactNode;
    agents: Map<string, HostedAgent>;
    chats: HostedChat[];
    label: string;
    selectedChatId: string | undefined;
    slug: string;
}) {
    return (
        <Sidebar.Group>
            <div className="flex items-center justify-between pe-1">
                <Sidebar.GroupLabel>{label}</Sidebar.GroupLabel>
                {action}
            </div>
            <Sidebar.Menu aria-label={label}>
                {chats.map((chat) => {
                    const agent = chat.peerAgentId ? (agents.get(chat.peerAgentId) ?? null) : null;
                    const name =
                        chat.kind === 'channel'
                            ? (chat.name ?? 'channel')
                            : (agent?.displayName ?? 'Direct message');
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
            </Sidebar.Menu>
        </Sidebar.Group>
    );
}

/** Hosted availability mapped onto the shared status-dot vocabulary. */
function hostedAvailabilityStatus(
    availability: HostedAgent['availability']
): StatusDotProps['status'] {
    switch (availability) {
        case 'idle':
            return 'success';
        case 'working':
            return 'warning';
        case 'error':
            return 'error';
        default:
            return 'muted';
    }
}

function ChatIcon({ agent }: { agent: HostedAgent | null }) {
    if (!agent) {
        return <ChannelIconBox size="sidebar" />;
    }

    return (
        <span className="relative flex size-5 shrink-0 items-center justify-center overflow-visible">
            <HostedAgentFace
                agent={agent}
                animate={false}
                size={20}
                style={{ flexShrink: 0, height: 20, overflow: 'visible', width: 20 }}
            />
            <StatusDot
                className="absolute right-0 bottom-0"
                size="md"
                status={hostedAvailabilityStatus(agent.availability)}
                title={agent.availability}
            />
        </span>
    );
}
