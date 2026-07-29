import { Copy01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { HostedAgentTabLoading } from './hosted-agent-tab-loading.tsx';

export function HostedAgentActivityTab({
    agent,
    server,
}: {
    agent: HostedAgent;
    server: ServerDetail;
}) {
    const activity = grottoTrpc.agent.activity.useQuery({
        agentId: agent.id,
        limit: 50,
        serverId: server.id,
    });
    const entries = activity.data ?? [];

    return (
        <div className="w-full px-5 pb-8 sm:px-7">
            <section className="grid gap-4 py-5">
                <BadgeDivider
                    action={
                        <Button
                            disabled={entries.length === 0}
                            onClick={() =>
                                void navigator.clipboard.writeText(
                                    entries
                                        .map(
                                            (entry) =>
                                                `${entry.endedAt} · ${entry.status} · ${entry.summary}`
                                        )
                                        .join('\n')
                                )
                            }
                            size="sm"
                            variant="secondary"
                        >
                            <Icon icon={Copy01Icon} />
                            Copy activity
                        </Button>
                    }
                    subtext={entries.length.toString()}
                    variant="subtle"
                >
                    Activity
                </BadgeDivider>
                {activity.isPending ? (
                    <HostedAgentTabLoading label="Loading activity..." />
                ) : entries.length === 0 ? (
                    <p className="text-base text-muted-foreground sm:text-sm">No activity yet.</p>
                ) : (
                    <ul className="divide-y divide-border/50 border-border/60 border-y">
                        {entries.map((entry) => (
                            <li
                                className="grid grid-cols-[5rem_auto_minmax(0,1fr)] items-baseline gap-3 py-3"
                                key={entry.runId}
                            >
                                <time className="text-meta text-muted-foreground tabular-nums">
                                    {new Date(entry.endedAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </time>
                                <StatusDot
                                    status={entry.status === 'failed' ? 'error' : 'success'}
                                />
                                <div className="min-w-0 text-base sm:text-sm">
                                    <span className="font-medium capitalize">{entry.status}</span>{' '}
                                    <span className="text-muted-foreground">{entry.summary}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
