import { Card, Label, ProgressBar, Skeleton } from '@heroui/react';
import type { IconSvgElement } from '@hugeicons/react';
import { ChatGptIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedUsageOverview } from '@tavern/api';
import { Icon } from '../../components/ui/icon.tsx';
import { useLiveUsageSuspense } from '../../hooks/models/use-live-usage.ts';
import { useModelInventorySuspense } from '../../hooks/models/use-model-inventory.ts';
import { formatTimestamp } from '../../lib/format.ts';
import type { LiveUsageOutput } from '../../lib/trpc.tsx';
import { UsageSpendModule } from './usage-spend-module.tsx';

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
                    icon={ChatGptIcon}
                    state={liveUsage?.codex}
                    title="Codex"
                    windowIds={['current-session', 'current-week']}
                    windowLabels={['5h Limit', 'Weekly Limit']}
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
            <Card.Content>
                <p className="text-muted text-sm">
                    Connect a supported model provider to show usage stats.
                </p>
            </Card.Content>
        </Card>
    );
}

function UsageCard({
    icon,
    state,
    title,
    windowIds,
    windowLabels,
}: {
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
            <Card.Header>
                <Card.Title>
                    <span className="flex items-center gap-2">
                        <Icon aria-hidden="true" icon={icon} size={20} />
                        {title}
                    </span>
                </Card.Title>
            </Card.Header>
            <Card.Content>
                {state?.status === 'error' ? (
                    <p className="text-muted text-sm">Usage unavailable</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {windows.map((w) => (
                            <div key={w.label}>
                                <ProgressBar
                                    aria-label={w.label}
                                    color={w.usedPercent >= 90 ? 'danger' : 'accent'}
                                    value={w.usedPercent}
                                >
                                    <Label>{w.label}</Label>
                                    <ProgressBar.Output />
                                    <ProgressBar.Track>
                                        <ProgressBar.Fill />
                                    </ProgressBar.Track>
                                </ProgressBar>
                                {w.resetsAt ? (
                                    <p className="mt-1 text-muted text-xs">
                                        Resets {formatTimestamp(w.resetsAt)}
                                    </p>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
            </Card.Content>
        </Card>
    );
}
