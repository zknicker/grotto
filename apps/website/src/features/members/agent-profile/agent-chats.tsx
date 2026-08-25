import type { Agent } from '@grotto/api';
import { Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup, PressableFeedback } from '@heroui-pro/react';
import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChannelIconBox } from '../../../components/chats/channel-icon-box.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgentChats } from '../../../hooks/members/use-agent-chats.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { serverChatRoute } from '../../servers/server-routes.ts';
import { AgentLoading } from './agent-loading.tsx';

/** The chats this Agent belongs to — membership, not a chat surface. */
export function AgentChats({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const navigate = useNavigate();
    const chats = useAgentChats(server.id, agent.id);
    if (chats.isPending) {
        return <AgentLoading label="Loading chats..." />;
    }
    const rows = chats.data ?? [];

    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>
                    Chats
                    <span className="ms-2 text-muted tabular-nums">{rows.length}</span>
                </ItemCardGroup.Title>
            </ItemCardGroup.Header>
            <ItemCardGroup className="overflow-hidden">
                {rows.length === 0 ? (
                    <ItemCard>
                        <ItemCard.Content>
                            <ItemCard.Description>No chats yet.</ItemCard.Description>
                        </ItemCard.Content>
                    </ItemCard>
                ) : (
                    rows.map((chat, index) => (
                        <React.Fragment key={chat.id}>
                            {index > 0 ? <Separator /> : null}
                            {/* Stock ItemCard rendered as a button, per its
                                Pressable pattern. The handler rides on ItemCard:
                                `render` spreads the component's own props last. */}
                            <ItemCard<'button'>
                                className="relative w-full cursor-(--cursor-interactive) overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                onClick={() => navigate(serverChatRoute(server.slug, chat.id))}
                                render={(props) => <button type="button" {...props} />}
                            >
                                <PressableFeedback.Highlight />
                                <ItemCard.Icon>
                                    {chat.kind === 'channel' ? (
                                        <ChannelIconBox
                                            color={chat.color}
                                            icon={chat.icon}
                                            size="inline"
                                        />
                                    ) : (
                                        <Icon aria-hidden="true" icon={BubbleChatIcon} />
                                    )}
                                </ItemCard.Icon>
                                <ItemCard.Content>
                                    <ItemCard.Title>
                                        {chat.name ?? `DM · @${agent.handle}`}
                                    </ItemCard.Title>
                                </ItemCard.Content>
                            </ItemCard>
                        </React.Fragment>
                    ))
                )}
            </ItemCardGroup>
        </ItemCardGroup>
    );
}
