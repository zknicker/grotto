import { Activity03Icon, ArchiveIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent, HostedChat } from '@tavern/api';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import { StatusDot, type StatusDotProps } from '../../components/ui/status-dot.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { HostedAgentFace } from '../members/hosted-agent-face.tsx';
import { AppSidebarFrame } from '../shell/sidebar.tsx';
import { SidebarAuthItems } from '../shell/sidebar-auth-items.tsx';
import { HostedServerChooser } from './hosted-server-chooser.tsx';

export function HostedServerSidebar({
    agents,
    chats,
    currentServer,
    onOpenActivity,
    onOpenChat,
    selectedChatId,
    servers,
}: {
    agents: HostedAgent[];
    chats: HostedChat[];
    currentServer: ServerSummary;
    onOpenActivity: () => void;
    onOpenChat: (chatId: string) => void;
    selectedChatId: string | undefined;
    servers: ServerSummary[];
}) {
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const channels = chats.filter((chat) => chat.kind === 'channel');
    const directMessages = chats.filter((chat) => chat.kind === 'dm');

    return (
        <AppSidebarFrame
            content={
                <>
                    <HostedServerChooser currentServer={currentServer} servers={servers} />
                    <SidebarGroup className="pt-2 pb-0">
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={onOpenActivity}>
                                        <Icon aria-hidden="true" icon={Activity03Icon} />
                                        <span className="font-medium">Activity</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                        <ChatGroup
                            agents={agentById}
                            chats={channels}
                            label="Channels"
                            onOpenChat={onOpenChat}
                            selectedChatId={selectedChatId}
                        />
                        <ChatGroup
                            agents={agentById}
                            chats={directMessages}
                            label="Direct messages"
                            onOpenChat={onOpenChat}
                            selectedChatId={selectedChatId}
                        />
                        <SidebarGroup className="pt-1 pb-2">
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton className="font-normal text-sidebar-muted">
                                            <Icon aria-hidden="true" icon={ArchiveIcon} />
                                            <span>Archived</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </div>
                </>
            }
            footer={<SidebarAuthItems />}
        />
    );
}

function ChatGroup({
    agents,
    chats,
    label,
    onOpenChat,
    selectedChatId,
}: {
    agents: Map<string, HostedAgent>;
    chats: HostedChat[];
    label: string;
    onOpenChat: (chatId: string) => void;
    selectedChatId: string | undefined;
}) {
    return (
        <SidebarGroup className="pt-1">
            <div className="flex h-8 items-center px-2 font-medium font-mono text-[var(--nav-section-label)] text-xs uppercase tracking-wider">
                {label}
            </div>
            <SidebarGroupContent>
                <SidebarMenu>
                    {chats.map((chat) => {
                        const agent = chat.peerAgentId
                            ? (agents.get(chat.peerAgentId) ?? null)
                            : null;
                        return (
                            <SidebarMenuItem key={chat.id}>
                                <SidebarMenuButton
                                    isActive={chat.id === selectedChatId}
                                    onClick={() => onOpenChat(chat.id)}
                                >
                                    <ChatIcon agent={agent} />
                                    <span className="min-w-0 flex-1 truncate">
                                        {chat.kind === 'channel'
                                            ? chat.name
                                            : (agent?.displayName ?? 'Direct message')}
                                    </span>
                                    {chat.unreadCount > 0 ? (
                                        <span className="flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-background text-micro tabular-nums">
                                            {chat.unreadCount}
                                        </span>
                                    ) : null}
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
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
        <span className="relative flex size-6 shrink-0 items-center justify-center overflow-visible">
            <HostedAgentFace
                agent={agent}
                animate={false}
                size={24}
                style={{ flexShrink: 0, height: 24, overflow: 'visible', width: 24 }}
            />
            <StatusDot
                className="absolute right-0 bottom-0 border-2 border-[var(--sidebar)]"
                size="md"
                status={hostedAvailabilityStatus(agent.availability)}
                title={agent.availability}
            />
        </span>
    );
}
