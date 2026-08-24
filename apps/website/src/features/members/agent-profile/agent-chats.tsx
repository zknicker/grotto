import { Chip, Separator } from '@heroui/react';
import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { Agent } from '@tavern/api';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChannelIconBox } from '../../../components/chats/channel-icon-box.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgentChats } from '../../../hooks/members/use-agent-chats.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { serverChatRoute } from '../../servers/server-routes.ts';
import { SettingsGroup, SettingsSection } from '../../settings/layout/settings-page.tsx';
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
        <SettingsSection
            action={
                <Chip size="sm" variant="soft">
                    {rows.length}
                </Chip>
            }
            title="Chats"
        >
            {rows.length === 0 ? (
                <p className="text-muted text-sm">No chats yet.</p>
            ) : (
                <SettingsGroup>
                    {rows.map((chat, index) => (
                        <React.Fragment key={chat.id}>
                            {index > 0 ? <Separator /> : null}
                            <button
                                className="flex w-full cursor-[var(--cursor-interactive)] items-center gap-3 px-4 py-3.5 text-left outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus"
                                onClick={() => navigate(serverChatRoute(server.slug, chat.id))}
                                type="button"
                            >
                                {chat.kind === 'channel' ? (
                                    <ChannelIconBox
                                        color={chat.color}
                                        icon={chat.icon}
                                        size="inline"
                                    />
                                ) : (
                                    <Icon
                                        aria-hidden="true"
                                        className="size-4 shrink-0 text-muted"
                                        icon={BubbleChatIcon}
                                    />
                                )}
                                <span className="truncate font-medium text-foreground text-sm">
                                    {chat.name ?? `DM · @${agent.handle}`}
                                </span>
                            </button>
                        </React.Fragment>
                    ))}
                </SettingsGroup>
            )}
        </SettingsSection>
    );
}
