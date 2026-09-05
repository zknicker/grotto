import type { Agent, Chat } from '@grotto/api';
import { ListView } from '@heroui-pro/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChannelIconBox } from '../../../components/chats/channel-icon-box.tsx';
import { UnreadCountChip } from '../../../components/chats/unread-count-chip.tsx';
import { RelativeTime } from '../../../components/time/relative-time.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useChats } from '../../../hooks/servers/use-chats.ts';
import { AgentAvatar } from '../../members/agent-avatar.tsx';
import { chatNavigationName } from '../../shell/chat-navigation-row.tsx';
import { useServerContext } from '../server-context.ts';
import { serverChatRoute } from '../server-routes.ts';
import { InboxSection, InboxSectionEmpty, InboxSectionPending } from './inbox-section.tsx';

/**
 * Unread conversation, newest first. Followed Threads and the last line of each
 * Chat join it once the Server exposes them; the unread counts themselves are
 * the existing read state, which this page only reads.
 */
export function InboxWhileYouWereAway() {
    const { server } = useServerContext();
    const navigate = useNavigate();
    const chats = useChats(server.id);
    const agents = useAgents(server.id);
    const agentById = React.useMemo(
        () => new Map((agents.data ?? []).map((agent) => [agent.id, agent])),
        [agents.data]
    );
    const unread = React.useMemo(() => selectUnreadChats(chats.data ?? []), [chats.data]);

    return (
        <InboxSection title="While you were away">
            {chats.data ? (
                unread.length === 0 ? (
                    <InboxSectionEmpty description="You’re caught up." />
                ) : (
                    <ListView
                        aria-label="Unread chats"
                        items={unread}
                        onAction={(key) => navigate(serverChatRoute(server.slug, String(key)))}
                        variant="secondary"
                    >
                        {(chat) => (
                            <UnreadChatItem
                                agent={
                                    chat.peerAgentId
                                        ? (agentById.get(chat.peerAgentId) ?? null)
                                        : null
                                }
                                chat={chat}
                            />
                        )}
                    </ListView>
                )
            ) : (
                <InboxSectionPending label="Loading unread chats" />
            )}
        </InboxSection>
    );
}

function UnreadChatItem({ agent, chat }: { agent: Agent | null; chat: Chat }) {
    const name = chatNavigationName(chat, agent);

    return (
        <ListView.Item id={chat.id} textValue={name}>
            <ListView.ItemContent>
                {agent ? (
                    <AgentAvatar agent={agent} size={24} />
                ) : (
                    <ChannelIconBox color={chat.color} icon={chat.icon} size="topbar" />
                )}
                <div className="flex min-w-0 flex-col">
                    <ListView.Title>{chat.kind === 'channel' ? `#${name}` : name}</ListView.Title>
                    <ListView.Description>
                        <RelativeTime fallback="no activity yet" value={chat.lastActivityAt} />
                    </ListView.Description>
                </div>
            </ListView.ItemContent>
            <ListView.ItemAction>
                <UnreadCountChip count={chat.unreadCount} />
            </ListView.ItemAction>
        </ListView.Item>
    );
}

/**
 * Unread conversation, most recently active first. Timestamps carry an offset
 * rather than a fixed zone, so they are compared as instants — a lexical
 * compare would order `-04:00` against `Z` by its text.
 */
function selectUnreadChats(chats: readonly Chat[]): Chat[] {
    return chats
        .filter((chat) => chat.unreadCount > 0)
        .sort((a, b) => lastActivityTime(b) - lastActivityTime(a));
}

function lastActivityTime(chat: Chat) {
    return chat.lastActivityAt ? Date.parse(chat.lastActivityAt) : 0;
}
