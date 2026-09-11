import type { Agent, Chat } from '@grotto/api';
import { ListView } from '@heroui-pro/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChannelIconBox } from '../../../components/chats/channel-icon-box.tsx';
import { UnreadCountChip } from '../../../components/chats/unread-count-chip.tsx';
import { RelativeTime } from '../../../components/time/relative-time.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useChats } from '../../../hooks/servers/use-chats.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useMembers } from '../../../hooks/servers/use-members.ts';
import { chatNavigationName } from '../../shell/chat-navigation-row.tsx';
import { useServerContext } from '../server-context.ts';
import { serverChatRoute } from '../server-routes.ts';
import { conversationPreviewLine } from './conversation-preview.ts';
import {
    InboxGlyphMark,
    InboxIdentityMark,
    InboxRowLine,
    InboxRowMeta,
    InboxRowPreview,
    InboxRowTitle,
} from './inbox-row.tsx';
import { InboxSection, InboxSectionEmpty, InboxSectionPending } from './inbox-section.tsx';

/**
 * Unread conversation, newest first, each row quoting the line that is waiting.
 * Followed Threads join it once the Server can list them; the unread counts
 * themselves are the existing read state, which this page only reads.
 */
export function InboxConversations() {
    const { server } = useServerContext();
    const navigate = useNavigate();
    const chats = useChats(server.id);
    const agents = useAgents(server.id);
    const members = useMembers(server.id);
    const humans = useHumanDirectory(server.id);
    const agentById = React.useMemo(
        () => new Map((agents.data ?? []).map((agent) => [agent.id, agent])),
        [agents.data]
    );
    const unread = React.useMemo(() => selectUnreadChats(chats.data ?? []), [chats.data]);
    const viewerUserId = members.data?.viewerUserId ?? null;
    const viewerDisplayName = viewerUserId ? humans.name(viewerUserId) : null;

    return (
        <InboxSection title="Conversations">
            {chats.data ? (
                unread.length === 0 ? (
                    <InboxSectionEmpty description="You’re caught up." />
                ) : (
                    <ListView
                        aria-label="Unread chats"
                        className="list-view--inbox"
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
                                viewerDisplayName={viewerDisplayName}
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

function UnreadChatItem({
    agent,
    chat,
    viewerDisplayName,
}: {
    agent: Agent | null;
    chat: Chat;
    viewerDisplayName: null | string;
}) {
    const name = chatNavigationName(chat, agent);
    const isDirect = chat.kind !== 'channel';
    const preview = conversationPreviewLine(chat.lastMessage, {
        peerDisplayName: isDirect ? name : null,
        viewerDisplayName,
    });

    return (
        <ListView.Item id={chat.id} textValue={name}>
            <ListView.ItemContent>
                {isDirect ? (
                    <InboxIdentityMark agent={agent} name={name} />
                ) : (
                    <InboxGlyphMark>
                        <ChannelIconBox color={chat.color} icon={chat.icon} size="topbar" />
                    </InboxGlyphMark>
                )}
                <InboxRowLine>
                    <InboxRowTitle>{chat.kind === 'channel' ? `#${name}` : name}</InboxRowTitle>
                    {/* The waiting line, as one truncated quote. A Chat that
                        holds no message yet says so instead. */}
                    <InboxRowPreview>{preview ?? 'no activity yet'}</InboxRowPreview>
                </InboxRowLine>
            </ListView.ItemContent>
            <ListView.ItemAction>
                <InboxRowMeta>
                    <span className="tabular-nums">
                        <RelativeTime fallback="" value={chat.lastActivityAt} />
                    </span>
                    <UnreadCountChip count={chat.unreadCount} />
                </InboxRowMeta>
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
