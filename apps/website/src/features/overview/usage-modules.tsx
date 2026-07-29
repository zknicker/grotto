import type { IconSvgElement } from '@hugeicons/react';
import { ChatGptIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedUsageOverview } from '@tavern/api';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Progress } from '../../components/ui/progress.tsx';
import { Skeleton } from '../../components/ui/skeleton.tsx';
import { useLiveUsageSuspense } from '../../hooks/models/use-live-usage.ts';
import { useModelInventorySuspense } from '../../hooks/models/use-model-inventory.ts';
import { formatTimestamp } from '../../lib/format.ts';
import type { LiveUsageOutput } from '../../lib/trpc.tsx';
import { UsageSpendModule } from './usage-spend-module.tsx';

const usageAccent = 'var(--color-brand)';
export type UsageOverview = HostedUsageOverview | LiveUsageOutput;

export function UsageModules() {
    const [liveUsage] = useLiveUsageSuspense();
    const [inventory] = useModelInventorySuspense();
    const connectedProviders = new Set(
        inventory.providers
            .filter((provider) => provider.isConnected)
            .map((provider) => provider.provider)
    );

    return <UsageModulesView connectedProviders={[...connectedProviders]} liveUsage={liveUsage} />;
}

export function UsageModulesView({
    allowOpenRouterConfiguration = true,
    connectedProviders,
    liveUsage,
}: {
    allowOpenRouterConfiguration?: boolean;
    connectedProviders: string[];
    liveUsage: HostedUsageOverview | LiveUsageOutput | undefined;
}) {
    const providerSet = new Set(connectedProviders);
    const showCodex = providerSet.has('openai-codex');
    const showOpenRouter =
        providerSet.has('openrouter') ||
        liveUsage?.openRouter.status === 'error' ||
        liveUsage?.openRouter.overview.status === 'unconfigured';

    return (
        <div className="grid gap-3">
            {showCodex ? (
                <UsageCard
                    accent={usageAccent}
                    icon={ChatGptIcon}
                    state={liveUsage?.codex}
                    title="Codex"
                    windowIds={['current-session', 'current-week']}
                    windowLabels={['5h limit', 'Weekly limit']}
                />
            ) : null}

            {showOpenRouter ? (
                <UsageSpendModule
                    allowManagementKeyForm={allowOpenRouterConfiguration}
                    liveUsage={liveUsage}
                />
            ) : null}

            {showCodex || showOpenRouter ? null : <NoSupportedUsageSources />}
        </div>
    );
}

export function UsageModulesSkeleton() {
    return (
        <div className="grid gap-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
        </div>
    );
}

function NoSupportedUsageSources() {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="text-muted-foreground text-sm">
                    Connect a supported model provider to show usage stats.
                </div>
            </CardContent>
        </Card>
    );
}

function UsageCard({
    accent,
    icon,
    state,
    title,
    windowIds,
    windowLabels,
}: {
    accent: string;
    icon: IconSvgElement;
    state: UsageOverview['codex'] | undefined;
    title: string;
    windowIds: string[];
    windowLabels: string[];
}) {
    const successState = state?.status === 'ok' ? state : null;

    const windows = windowIds.map((id, i) => {
        const w = successState?.snapshot.windows.find((win) => win.id === id);
        return {
            label: windowLabels[i],
            resetsAt: w?.resetsAt ?? null,
            usedPercent: w?.usedPercent ?? 0,
        };
    });

    return (
        <Card>
            <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2 font-bold text-sm tracking-tight">
                    <Icon icon={icon} size={20} />
                    {title}
                </div>
                {state?.status === 'error' ? (
                    <div className="text-muted-foreground text-sm">Usage unavailable</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {windows.map((w) => {
                            const barColor = w.usedPercent >= 90 ? '#ef4444' : accent;
                            return (
                                <div key={w.label}>
                                    <div className="mb-1 flex items-center justify-between gap-3">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-medium text-foreground text-sm">
                                                {w.label}
                                            </span>
                                            {w.resetsAt ? (
                                                <span className="text-muted-foreground text-xs">
                                                    Resets {formatTimestamp(w.resetsAt)}
                                                </span>
                                            ) : null}
                                        </div>
                                        <span
                                            className="shrink-0 font-semibold text-sm tabular-nums"
                                            style={{ color: barColor }}
                                        >
                                            {w.usedPercent}%
                                        </span>
                                    </div>
                                    <Progress color={barColor} value={w.usedPercent} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
