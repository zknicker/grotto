import type { Agent } from '@haus/api';
import { Separator } from '@heroui/react';
import { ItemCard } from '@heroui-pro/react';
import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { getChannelColorStyle } from '../../../components/chats/channel-color-options.ts';
import { useChannelIconGlyph } from '../../../components/chats/channel-icon-catalog.ts';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgentChats } from '../../../hooks/members/use-agent-chats.ts';
import type { ServerDetail } from '../../../lib/haus-server.tsx';
import { serverChatRoute } from '../../servers/server-routes.ts';
import { formatPeekChatLabel } from './agent-peek-model.ts';
import { PeekEmptyRow, PeekPressableCard, PeekSection } from './peek-section.tsx';

type AgentChat = NonNullable<ReturnType<typeof useAgentChats>['data']>[number];

/** Where this Agent is reachable. Pressing a row goes to that Chat. */
export function AgentPeekChats({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const navigate = useNavigate();
    const chats = useAgentChats(server.id, agent.id);
    const rows = chats.data;

    return (
        <PeekSection count={rows?.length} title="Chats">
            {rows
                ? rows.map((chat, index) => (
                      <React.Fragment key={chat.id}>
                          {index > 0 ? <Separator /> : null}
                          <AgentPeekChatRow
                              chat={chat}
                              label={formatPeekChatLabel(chat, agent.handle)}
                              onOpen={() => navigate(serverChatRoute(server.slug, chat.id))}
                          />
                      </React.Fragment>
                  ))
                : null}
            {rows?.length === 0 ? <PeekEmptyRow>No chats yet.</PeekEmptyRow> : null}
        </PeekSection>
    );
}

/**
 * `ItemCard.Icon` is already a filled, rounded box, so it carries only the
 * glyph and the Channel's configured color; nesting a ChannelIconBox would put
 * a second box with its own radius inside the slot's.
 */
function AgentPeekChatRow({
    chat,
    label,
    onOpen,
}: {
    chat: AgentChat;
    label: string;
    onOpen: () => void;
}) {
    const channelGlyph = useChannelIconGlyph(chat.icon);

    return (
        <PeekPressableCard onPress={onOpen}>
            <ItemCard.Icon
                className={chat.kind === 'channel' ? 'channel-icon-box' : undefined}
                style={chat.kind === 'channel' ? getChannelColorStyle(chat.color) : undefined}
            >
                <Icon
                    aria-hidden="true"
                    icon={chat.kind === 'channel' ? channelGlyph : BubbleChatIcon}
                />
            </ItemCard.Icon>
            <ItemCard.Content>
                <ItemCard.Title>{label}</ItemCard.Title>
            </ItemCard.Content>
        </PeekPressableCard>
    );
}
