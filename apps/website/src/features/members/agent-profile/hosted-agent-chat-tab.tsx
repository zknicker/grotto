import { HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import { useNavigate } from 'react-router-dom';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { serverChatRoute } from '../../servers/server-routes.ts';
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
        <div className="w-full px-5 pb-8 sm:px-7">
            <section className="grid gap-4 py-5">
                <BadgeDivider subtext={rows.length.toString()} variant="subtle">
                    Chats
                </BadgeDivider>
                {rows.length === 0 ? (
                    <p className="text-base text-muted-foreground sm:text-sm">No chats yet.</p>
                ) : (
                    <ul className="divide-y divide-border/50 border-border/60 border-y">
                        {rows.map((chat) => (
                            <li key={chat.id}>
                                <button
                                    className="flex w-full items-center gap-3 py-3 text-left outline-none hover:bg-legacy-accent/20 focus-visible:bg-legacy-accent/20"
                                    onClick={() => navigate(serverChatRoute(server.slug, chat.id))}
                                    type="button"
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="size-4 shrink-0 text-muted-foreground"
                                        icon={
                                            chat.kind === 'channel' ? HashtagIcon : BubbleChatIcon
                                        }
                                    />
                                    <span className="truncate font-medium text-base text-foreground sm:text-sm">
                                        {chat.name ?? `Direct · @${agent.handle}`}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
