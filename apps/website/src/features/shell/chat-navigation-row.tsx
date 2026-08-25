import type { Agent, Chat } from '@grotto/api';
import { Chip } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import type * as React from 'react';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { AgentAvatar } from '../members/agent-avatar.tsx';
import { serverChatRoute } from '../servers/server-routes.ts';

export function ChatNavigationRow({
    agent,
    ariaDescribedBy,
    chat,
    className,
    name,
    ref,
    selectedChatId,
    slug,
    style,
}: {
    agent: Agent | null;
    ariaDescribedBy?: string;
    chat: Chat;
    className?: string;
    name: string;
    ref?: React.Ref<HTMLDivElement>;
    selectedChatId: string | undefined;
    slug: string;
    style?: React.CSSProperties;
}) {
    return (
        <Sidebar.MenuItem
            aria-describedby={ariaDescribedBy}
            className={className}
            href={serverChatRoute(slug, chat.id)}
            id={chat.id}
            isCurrent={chat.id === selectedChatId}
            ref={ref}
            style={style}
            textValue={name}
        >
            <ChatNavigationRowContent agent={agent} chat={chat} name={name} />
        </Sidebar.MenuItem>
    );
}

export function ChatNavigationRowContent({
    agent,
    chat,
    name,
}: {
    agent: Agent | null;
    chat: Chat;
    name: string;
}) {
    return (
        <>
            <Sidebar.MenuIcon>
                <ChatIcon agent={agent} chat={chat} />
            </Sidebar.MenuIcon>
            <Sidebar.MenuItemContent>
                <Sidebar.MenuLabel
                    className={chat.unreadCount > 0 ? 'font-medium text-foreground' : undefined}
                >
                    {name}
                </Sidebar.MenuLabel>
                <ChatRowChip chat={chat} />
            </Sidebar.MenuItemContent>
        </>
    );
}

export function chatNavigationName(chat: Chat, agent: Agent | null): string {
    return chat.kind === 'channel'
        ? (chat.name ?? 'channel')
        : (agent?.displayName ?? chat.peerAgentDisplayName ?? 'DM');
}

function ChatRowChip({ chat }: { chat: Chat }) {
    if (chat.unreadCount === 0) {
        return null;
    }
    return (
        <Chip
            aria-label={`${chat.unreadCount} unread`}
            className="min-w-5 justify-center tabular-nums"
            color="accent"
            size="sm"
            variant="primary"
        >
            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
        </Chip>
    );
}

function ChatIcon({ agent, chat }: { agent: Agent | null; chat: Chat }) {
    if (!agent) {
        return <ChannelIconBox color={chat.color} icon={chat.icon} size="sidebar" />;
    }

    return <AgentAvatar agent={agent} size={24} />;
}
