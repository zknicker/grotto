import type { Agent, Chat } from '@grotto/api';
import { Chip } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import type * as React from 'react';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { AgentAvatar } from '../members/agent-avatar.tsx';
import { serverChatRoute } from '../servers/server-routes.ts';
import { ChatNavigationContextMenu } from './chat-navigation-context-menu.tsx';

export function ChatNavigationRow({
    agent,
    ariaDescribedBy,
    chat,
    className,
    name,
    onChangeChannelColor,
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
    onChangeChannelColor?: (chat: Chat, color: string) => void;
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
            <ChatNavigationContextMenu
                agent={agent}
                chat={chat}
                onChangeChannelColor={onChangeChannelColor}
                slug={slug}
            >
                <ChatNavigationRowContent agent={agent} chat={chat} name={name} />
            </ChatNavigationContextMenu>
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
