import type { HostedAgent, HostedChat } from '@tavern/api';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import {
    serverActivityRoute,
    serverChatRoute,
    serverMembersRoute,
} from '../servers/server-routes.ts';
import { StarterHomeCanvas } from './home-canvas.tsx';
import type { OverviewActivityItem } from './overview-activity.ts';
import type { OverviewAgent, OverviewPresenceEntry } from './overview-types.ts';
import { OverviewView } from './overview-view.tsx';

const activityLimit = 20;
const sparklineDays = 7;
const dayMs = 24 * 60 * 60 * 1000;

export function HostedOverview({
    agents,
    chats,
    slug,
}: {
    agents: HostedAgent[];
    chats: HostedChat[];
    slug: string;
}) {
    const now = useRelativeNow();
    const overviewAgents = agents.map(toOverviewAgent);

    return (
        <OverviewView
            activity={buildHostedOverviewActivity(chats, slug)}
            activityHref={serverActivityRoute(slug)}
            activitySeriesByAgentId={buildHostedActivitySeries(agents, chats, now)}
            agents={overviewAgents}
            homeCanvas={<StarterHomeCanvas agents={overviewAgents} />}
            modelRefByAgentId={
                new Map(
                    agents.map((agent) => [
                        agent.id,
                        agent.effectiveModelId ?? agent.desiredModelId ?? null,
                    ])
                )
            }
            now={now}
            presence={agents.map(toOverviewPresence)}
            resolveAgentHref={(agentId) =>
                `${serverMembersRoute(slug)}/agents/${encodeURIComponent(agentId)}`
            }
        />
    );
}

export function toOverviewAgent(agent: HostedAgent): OverviewAgent {
    return {
        avatarUrl: agent.avatarUrl,
        id: agent.id,
        name: agent.displayName,
        primaryColor: null,
    };
}

export function buildHostedOverviewActivity(
    chats: HostedChat[],
    slug: string
): OverviewActivityItem[] {
    return chats
        .flatMap((chat) => {
            if (!chat.lastActivityAt) {
                return [];
            }

            const atMs = Date.parse(chat.lastActivityAt);
            if (Number.isNaN(atMs)) {
                return [];
            }

            return [
                {
                    agentId: chat.peerAgentId,
                    at: chat.lastActivityAt,
                    atMs,
                    description:
                        chat.kind === 'channel'
                            ? `#${chat.name ?? 'channel'} had new activity`
                            : 'Direct message had new activity',
                    href: serverChatRoute(slug, chat.id),
                    key: chat.id,
                    kind: 'message_received' as const,
                },
            ];
        })
        .sort((left, right) => right.atMs - left.atMs)
        .slice(0, activityLimit);
}

function buildHostedActivitySeries(agents: HostedAgent[], chats: HostedChat[], now: number) {
    const seriesByAgentId = new Map(
        agents.map((agent) => [agent.id, new Array<number>(sparklineDays).fill(0)])
    );

    for (const chat of chats) {
        if (!(chat.peerAgentId && chat.lastActivityAt)) {
            continue;
        }

        const atMs = Date.parse(chat.lastActivityAt);
        const dayAgo = Math.floor((now - atMs) / dayMs);
        const series = seriesByAgentId.get(chat.peerAgentId);

        if (!(series && dayAgo >= 0 && dayAgo < sparklineDays)) {
            continue;
        }

        const bucket = sparklineDays - 1 - dayAgo;
        series[bucket] = (series[bucket] ?? 0) + 1;
    }

    return seriesByAgentId;
}

function toOverviewPresence(agent: HostedAgent): OverviewPresenceEntry {
    switch (agent.status) {
        case 'applied':
            return { agentId: agent.id, label: 'Idle', state: 'idle', tone: 'success' };
        case 'degraded':
            return { agentId: agent.id, label: 'Degraded', state: 'idle', tone: 'warning' };
        case 'pending':
            return { agentId: agent.id, label: 'Pending', state: 'idle', tone: 'warning' };
    }
}
