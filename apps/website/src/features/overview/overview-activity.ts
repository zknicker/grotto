import type { AgentActivityOutput } from '../../lib/trpc.tsx';

type ActivityEntry = AgentActivityOutput['entries'][number];

export interface OverviewActivityItem {
    agentId: string | null;
    at: string;
    atMs: number;
    description: string;
    href?: string;
    key: string;
    kind: ActivityEntry['kind'];
}

export interface OverviewActivityFeed {
    items: OverviewActivityItem[];
    /** Events per day, oldest→newest, over the trailing week — the card
        sparkline series. */
    seriesByAgentId: Map<string, number[]>;
}

const feedLimit = 20;
const sparklineDays = 7;
const dayMs = 24 * 60 * 60 * 1000;

// The workspace feed shows what agents *did*; inbound user messages are
// timeline noise here.
const feedKinds = new Set<ActivityEntry['kind']>(['completed', 'failed', 'new_session', 'stopped']);

export function buildOverviewActivityFeed(
    agents: Array<{ agentId: string; entries: ActivityEntry[] }>,
    now: number
): OverviewActivityFeed {
    const items: OverviewActivityItem[] = [];
    const seriesByAgentId = new Map<string, number[]>();

    for (const { agentId, entries } of agents) {
        const series = new Array<number>(sparklineDays).fill(0);

        for (const entry of entries) {
            const atMs = Date.parse(entry.at);

            if (Number.isNaN(atMs)) {
                continue;
            }

            const dayAgo = Math.floor((now - atMs) / dayMs);

            if (dayAgo >= 0 && dayAgo < sparklineDays) {
                const bucket = sparklineDays - 1 - dayAgo;
                series[bucket] = (series[bucket] ?? 0) + 1;
            }

            if (feedKinds.has(entry.kind)) {
                items.push({
                    agentId,
                    at: entry.at,
                    atMs,
                    description: describeActivityEntry(entry),
                    key: `${agentId}:${entry.at}:${entry.kind}:${entry.turnId ?? ''}`,
                    kind: entry.kind,
                });
            }
        }

        seriesByAgentId.set(agentId, series);
    }

    items.sort((left, right) => right.atMs - left.atMs);

    return { items: items.slice(0, feedLimit), seriesByAgentId };
}

/** The clause next to the agent chip: what the agent did. Entries carry no
    chat anchor (specs/presence.md), so the row never references a chat. */
export function describeActivityEntry(entry: ActivityEntry): string {
    switch (entry.kind) {
        case 'completed':
            return entry.detail ? `replied — ${entry.detail}` : 'replied';
        case 'failed':
            return 'hit an error';
        case 'message_received':
            return 'received a message';
        case 'new_session':
            return 'started a fresh session';
        case 'stopped':
            return 'was stopped';
        default:
            return 'did something';
    }
}
