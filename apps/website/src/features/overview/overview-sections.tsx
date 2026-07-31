import { Card, Chip } from '@heroui/react';
import { AlertCircleIcon, BubbleChatIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { RefreshIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Link, useNavigate } from 'react-router-dom';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { appRoutes } from '../../lib/app-routes.ts';
import { formatRelativeTime } from '../../lib/format.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from '../chats/agent-face.tsx';
import type { OverviewActivityItem } from './overview-activity.ts';
import type { OverviewAgent, OverviewPresenceEntry } from './overview-types.ts';

type Agent = OverviewAgent;
type PresenceEntry = OverviewPresenceEntry;

export function OverviewAgentCards({
    agents,
    modelRefByAgentId,
    presence,
    resolveAgentHref = appRoutes.memberAgent,
    seriesByAgentId,
}: {
    agents: Agent[];
    modelRefByAgentId: Map<string, string | null>;
    presence: PresenceEntry[];
    resolveAgentHref?: (agentId: string) => string;
    seriesByAgentId: Map<string, number[]>;
}) {
    const dark = useResolvedThemeOptional() === 'dark';

    return (
        <div className="flex flex-wrap gap-3">
            {agents.map((agent) => {
                const entry = presence.find((candidate) => candidate.agentId === agent.id);
                const busy = entry?.state === 'busy';
                const animate = entry?.animate ?? busy;
                const statusLabel = entry?.label ?? (busy ? 'Working' : 'Idle');
                const statusTone = entry?.tone ?? (busy ? 'warning' : 'success');
                const modelName = formatModelName(modelRefByAgentId.get(agent.id) ?? null);
                const series = seriesByAgentId.get(agent.id) ?? [];
                const weekTotal = series.reduce((sum, value) => sum + value, 0);

                return (
                    <Link
                        className="group min-w-56 flex-1 sm:max-w-80"
                        key={agent.id}
                        to={resolveAgentHref(agent.id)}
                    >
                        <Card className="h-full gap-2.5 transition-colors group-hover:bg-surface-secondary">
                            <div className="flex items-center gap-2.5">
                                <span aria-hidden="true" className="flex shrink-0 items-center">
                                    <AgentFace
                                        animate={animate}
                                        dark={dark}
                                        emotion={animate ? 'curious' : 'idle'}
                                        head={agent.effectiveCharacter}
                                        ink={resolveAgentInk(dark, agent.effectivePrimaryColor)}
                                        size={30}
                                    />
                                </span>
                                <span className="min-w-0 flex-1 truncate font-semibold text-foreground text-sm">
                                    {agent.name}
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5 text-muted text-xs">
                                    <StatusDot
                                        status={statusTone === 'warning' ? 'warning' : 'success'}
                                    />
                                    {statusLabel}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                {modelName ? (
                                    <Chip className="min-w-0" size="sm" variant="soft">
                                        <Chip.Label className="truncate font-mono">
                                            {modelName}
                                        </Chip.Label>
                                    </Chip>
                                ) : (
                                    <span className="text-muted text-xs">No model set</span>
                                )}
                                <span className="flex shrink-0 items-center gap-2">
                                    <ActivitySparkline series={series} />
                                    <span className="whitespace-nowrap text-muted text-xs tabular-nums">
                                        {weekTotal} · 7d
                                    </span>
                                </span>
                            </div>
                        </Card>
                    </Link>
                );
            })}
        </div>
    );
}

export function OverviewActivity({
    activity,
    activityHref = appRoutes.activity,
    agents,
    now,
    resolveAgentHref = appRoutes.memberAgent,
}: {
    activity: OverviewActivityItem[];
    activityHref?: string;
    agents: Agent[];
    now: number;
    resolveAgentHref?: (agentId: string) => string;
}) {
    const dark = useResolvedThemeOptional() === 'dark';
    const navigate = useNavigate();

    return (
        <Card className="gap-0 overflow-hidden p-0">
            <header className="flex items-center justify-between border-separator border-b px-4 py-2.5">
                <h2 className="font-medium text-base text-foreground">Activity</h2>
                <span className="text-muted text-xs tabular-nums">{activity.length}</span>
            </header>
            {activity.length === 0 ? (
                <p className="px-4 py-3 text-muted text-sm">
                    Quiet so far — Agent replies, automations, and task pickups land here.
                </p>
            ) : (
                <div>
                    {activity.map((item) => {
                        const agent = agents.find((entry) => entry.id === item.agentId);
                        const target =
                            item.href ?? (agent ? resolveAgentHref(agent.id) : activityHref);

                        return (
                            <button
                                className="grid h-9 w-full grid-cols-[2.25rem_minmax(0,1fr)_5rem] items-center border-separator border-b text-left outline-none last:border-b-0 hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
                                key={item.key}
                                onClick={() => navigate(target)}
                                type="button"
                            >
                                <span className="flex justify-center">
                                    <Icon
                                        aria-hidden="true"
                                        className="size-4 text-muted"
                                        icon={activityKindIcons[item.kind]}
                                        strokeWidth={1.8}
                                    />
                                </span>
                                <span className="flex min-w-0 items-center gap-1.5 px-2">
                                    {agent ? <AgentChip agent={agent} dark={dark} /> : null}
                                    <span className="truncate text-foreground text-sm">
                                        {item.description}
                                    </span>
                                </span>
                                <span className="px-3 text-right text-muted text-xs tabular-nums">
                                    {formatRelativeTime(item.at, now)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}

const activityKindIcons: Record<OverviewActivityItem['kind'], IconSvgElement> = {
    completed: BubbleChatIcon,
    failed: AlertCircleIcon,
    message_received: BubbleChatIcon,
    new_session: RefreshIcon,
    stopped: Cancel01Icon,
};

// The same agent identity used in chat rows: face plus name.
function AgentChip({ agent, dark }: { agent: Agent; dark: boolean }) {
    return (
        <span className="flex min-w-0 shrink-0 items-center gap-1.5">
            <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
                <AgentFace
                    animate={false}
                    dark={dark}
                    head={agent.effectiveCharacter}
                    ink={resolveAgentInk(dark, agent.effectivePrimaryColor)}
                    size={24}
                />
            </span>
            <span className="truncate font-medium text-foreground text-sm">{agent.name}</span>
        </span>
    );
}

/** Tiny 7-day event-count sparkline. Flat when the week is quiet. */
function ActivitySparkline({ series }: { series: number[] }) {
    const width = 72;
    const height = 20;
    const max = Math.max(1, ...series);
    const step = series.length > 1 ? width / (series.length - 1) : width;
    const points = series
        .map((value, index) => {
            const x = index * step;
            const y = height - 2 - (value / max) * (height - 4);

            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return (
        <svg
            aria-hidden="true"
            className="shrink-0 text-accent"
            height={height}
            role="img"
            width={width}
        >
            <polyline
                fill="none"
                points={points}
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
            />
        </svg>
    );
}

function formatModelName(modelRef: string | null) {
    if (!modelRef) {
        return null;
    }

    const model = modelRef.split(':').at(-1) ?? modelRef;

    return model.split('/').at(-1) ?? model;
}
