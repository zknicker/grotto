import type { Agent, Chat } from '@grotto/api';
import { Button, Chip } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { Plus } from '@hugeicons/core-free-icons';
import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { loadChannelIconCatalog } from '../../components/chats/channel-icon-catalog.ts';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import { AgentAvatar } from '../members/agent-avatar.tsx';
import { serverChatRoute, tasksRoute } from '../servers/server-routes.ts';
import { useCommandMenu } from './command-menu-provider.tsx';
import { RouteTabIcon } from './route-tab-presentation.tsx';
import { shellNavigationIconSize } from './section-header.tsx';
import { ShellSidebarPageContent } from './shell-sidebar.tsx';

export function ChatNavigation({
    agents,
    chats,
    onCreateChannel,
    onPreloadSection,
    selectedChatId,
    slug,
}: {
    agents: Agent[];
    chats: Chat[];
    onCreateChannel: () => void;
    onPreloadSection: (section: 'search' | 'tasks') => void;
    selectedChatId: string | undefined;
    slug: string;
}) {
    const location = useLocation();
    const { open: openCommandMenu } = useCommandMenu();
    // Channel glyphs live in a lazily imported catalog. Warm it as soon as the
    // chat list mounts so rows and the picker have it before they need it.
    React.useEffect(() => {
        // The hash fallback already covers a failed load; this warm-up just
        // needs to kick the retryable import off.
        loadChannelIconCatalog().catch(() => undefined);
    }, []);
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const channels = chats.filter((chat) => chat.kind === 'channel');
    const directMessages = chats.filter((chat) => chat.kind === 'dm' && !chat.peerAgentRetired);

    return (
        <ShellSidebarPageContent>
            <Sidebar.Group>
                {/* One menu so Search and Tasks share the row pitch exactly.
                    Search opens the command palette rather than navigating,
                    so it is an action item that names its own shortcut. */}
                <Sidebar.Menu
                    aria-label="Server"
                    onAction={(key) => {
                        if (key === 'search') {
                            openCommandMenu();
                        }
                    }}
                >
                    <Sidebar.MenuItem
                        id="search"
                        onHoverStart={() => onPreloadSection('search')}
                        textValue="Search"
                    >
                        <Sidebar.MenuIcon>
                            <RouteTabIcon size={16} tab="search" />
                        </Sidebar.MenuIcon>
                        <Sidebar.MenuItemContent>
                            <Sidebar.MenuLabel>Search</Sidebar.MenuLabel>
                        </Sidebar.MenuItemContent>
                    </Sidebar.MenuItem>
                    <Sidebar.MenuItem
                        href={tasksRoute(slug)}
                        id="tasks"
                        isCurrent={location.pathname.startsWith(tasksRoute(slug))}
                        onHoverStart={() => onPreloadSection('tasks')}
                        textValue="Tasks"
                    >
                        <Sidebar.MenuIcon>
                            <RouteTabIcon size={16} tab="tasks" />
                        </Sidebar.MenuIcon>
                        <Sidebar.MenuItemContent>
                            <Sidebar.MenuLabel>Tasks</Sidebar.MenuLabel>
                        </Sidebar.MenuItemContent>
                    </Sidebar.MenuItem>
                </Sidebar.Menu>
            </Sidebar.Group>
            <ChatGroup
                action={
                    <Button
                        aria-label="New channel"
                        isIconOnly
                        onPress={onCreateChannel}
                        size="sm"
                        variant="ghost"
                    >
                        <Icon aria-hidden="true" icon={Plus} size={shellNavigationIconSize} />
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
        </ShellSidebarPageContent>
    );
}

function ChatGroup({
    action,
    agents,
    chats,
    children,
    label,
    selectedChatId,
    slug,
}: {
    action?: React.ReactNode;
    agents: Map<string, Agent>;
    chats: Chat[];
    children?: React.ReactNode;
    label: string;
    selectedChatId: string | undefined;
    slug: string;
}) {
    const [collapsed, setCollapsed] = React.useState(false);

    return (
        <Sidebar.Group>
            {/* The label is the disclosure, so a long channel list can be folded
                away without spending a row on a control. */}
            <div className="group/section flex w-full items-center justify-between">
                <button
                    aria-expanded={!collapsed}
                    // ps mirrors the literal 0.5rem HeroUI pads menu rows with,
                    // so the caret keeps the icons' left edge at any density.
                    className="flex min-w-0 cursor-[var(--cursor-interactive)] items-center gap-0.5 rounded-lg ps-[0.5rem]"
                    onClick={() => setCollapsed((current) => !current)}
                    type="button"
                >
                    {/* Caret leads the label: it points at what it folds, and
                        keeps the disclosure on the sidebar's left rhythm. */}
                    <Icon
                        aria-hidden="true"
                        className={cn(
                            'shrink-0 text-muted transition-transform',
                            collapsed && '-rotate-90'
                        )}
                        icon={ArrowDown01Icon}
                        size={12}
                        style={{ height: 12, width: 12 }}
                    />
                    <Sidebar.GroupLabel className="px-0">{label}</Sidebar.GroupLabel>
                </button>
                {/* Quiet chrome: the action only appears on hover or focus,
                    the way HeroUI's own menu actions behave. */}
                <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/section:opacity-100">
                    {action}
                </span>
            </div>
            <Sidebar.Menu aria-label={label} className={collapsed ? 'hidden' : undefined}>
                {chats.map((chat) => {
                    const agent = chat.peerAgentId ? (agents.get(chat.peerAgentId) ?? null) : null;
                    const name =
                        chat.kind === 'channel'
                            ? (chat.name ?? 'channel')
                            : (agent?.displayName ?? chat.peerAgentDisplayName ?? 'DM');
                    return (
                        <Sidebar.MenuItem
                            href={serverChatRoute(slug, chat.id)}
                            id={chat.id}
                            isCurrent={chat.id === selectedChatId}
                            key={chat.id}
                            textValue={name}
                        >
                            <Sidebar.MenuIcon>
                                <ChatIcon agent={agent} chat={chat} />
                            </Sidebar.MenuIcon>
                            <Sidebar.MenuItemContent>
                                <Sidebar.MenuLabel
                                    className={
                                        chat.unreadCount > 0
                                            ? 'font-medium text-foreground'
                                            : undefined
                                    }
                                >
                                    {name}
                                </Sidebar.MenuLabel>
                                <ChatRowChip chat={chat} />
                            </Sidebar.MenuItemContent>
                        </Sidebar.MenuItem>
                    );
                })}
                {children}
            </Sidebar.Menu>
        </Sidebar.Group>
    );
}

/**
 * Unread is the only quantity worth a badge on a navigation row. This slot
 * used to fall back to the channel's participant count in the same muted
 * styling, so two unrelated numbers were indistinguishable — which is what
 * made the counts read as arbitrary. A participant count is not a reason to
 * open a channel; unread mail is.
 */
function ChatRowChip({ chat }: { chat: Chat }) {
    if (chat.unreadCount === 0) {
        return null;
    }
    return (
        <Chip aria-label={`${chat.unreadCount} unread`} color="accent" size="sm" variant="primary">
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
