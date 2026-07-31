import { Chip, Separator } from '@heroui/react';
import { HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { serverChatRoute } from '../../servers/server-routes.ts';
import {
    SettingsGroup,
    SettingsPage,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';
import { HostedAgentTabLoading } from './hosted-agent-tab-loading.tsx';

export function HostedAgentChatTab({
    agent,
    server,
}: {
    agent: HostedAgent;
    server: ServerDetail;
}) {
    const navigate = useNavigate();
    const chats = grottoTrpc.agent.chats.useQuery({
        agentId: agent.id,
        serverId: server.id,
    });
    if (chats.isPending) {
        return (
            <div className="px-5 sm:px-7">
                <HostedAgentTabLoading label="Loading chats..." />
            </div>
        );
    }
    const rows = chats.data ?? [];

    return (
        <div className="px-5 py-6 sm:px-7">
            <SettingsPage>
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
                                        className="flex w-full cursor-[var(--cursor-interactive)] items-center gap-3 px-4 py-3.5 text-left outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus"
                                        onClick={() =>
                                            navigate(serverChatRoute(server.slug, chat.id))
                                        }
                                        type="button"
                                    >
                                        <Icon
                                            aria-hidden="true"
                                            className="size-4 shrink-0 text-muted"
                                            icon={
                                                chat.kind === 'channel'
                                                    ? HashtagIcon
                                                    : BubbleChatIcon
                                            }
                                        />
                                        <span className="truncate font-medium text-foreground text-sm">
                                            {chat.name ?? `Direct · @${agent.handle}`}
                                        </span>
                                    </button>
                                </React.Fragment>
                            ))}
                        </SettingsGroup>
                    )}
                </SettingsSection>
            </SettingsPage>
        </div>
    );
}
