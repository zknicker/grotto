import { Button, Card, Skeleton } from '@heroui/react';
import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { useUsage } from '../../hooks/servers/use-usage.ts';
import { computerLabel } from '../computers/presentation.ts';
import { SettingsPage } from '../settings/layout/settings-page.tsx';
import { AgentsTokenUsage } from '../stats/token-usage-module.tsx';

export function AgentsUsageOverview({ serverId }: { serverId: string }) {
    const usage = useUsage(serverId);
    const agents = useAgents(serverId);
    const computers = useComputers(serverId);
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedComputerId = searchParams.get('computer');
    const runtimeId = searchParams.get('runtime') || undefined;
    const computer = computers.data?.find((item) => item.id === requestedComputerId);
    const computerId = computer?.id;
    const computerFilterLabel = requestedComputerId
        ? computer
            ? computerLabel(computer)
            : computers.isPending
              ? 'Loading…'
              : 'Unavailable'
        : undefined;
    const scope = useMemo(
        () => ({
            agentIds: requestedComputerId
                ? computerId
                    ? (agents.data ?? [])
                          .filter((agent) => agent.computerId === computerId)
                          .map((agent) => agent.id)
                    : []
                : undefined,
            knownAgents: (agents.data ?? []).map((agent) => ({
                agentAvatarUrl: agent.avatarUrl,
                agentHandle: agent.handle,
                agentId: agent.id,
                agentName: agent.displayName,
            })),
            runtimeId,
        }),
        [agents.data, computerId, requestedComputerId, runtimeId]
    );
    const isFilterPending =
        Boolean(requestedComputerId) &&
        ((!agents.data && agents.isPending) || (!computers.data && computers.isPending));

    return (
        <div className="w-full px-5 py-8 sm:px-7">
            <SettingsPage className="max-w-[96rem] gap-6">
                {computerFilterLabel || runtimeId ? (
                    <ActiveUsageFilters
                        computerLabel={computerFilterLabel}
                        onRemove={(key) =>
                            setSearchParams(
                                (params) => {
                                    const next = new URLSearchParams(params);
                                    next.delete(key);
                                    return next;
                                },
                                { replace: true }
                            )
                        }
                        runtimeLabel={runtimeId ? runtimeLabel(runtimeId) : undefined}
                    />
                ) : null}
                {isFilterPending ? (
                    <TokenUsageSkeleton />
                ) : usage.data?.tokenUsage ? (
                    <AgentsTokenUsage
                        emptyMessage={
                            runtimeId === 'pi'
                                ? 'Usage will appear after a Pi Agent completes a model turn.'
                                : undefined
                        }
                        scope={scope}
                        usage={usage.data.tokenUsage}
                    />
                ) : usage.data ? (
                    <UsageMessage
                        description="Usage will appear after an Agent completes a model turn."
                        title="No Agent usage yet"
                    />
                ) : usage.error ? (
                    <UsageMessage description={usage.error.message} title="Usage unavailable" />
                ) : (
                    <TokenUsageSkeleton />
                )}
            </SettingsPage>
        </div>
    );
}

function ActiveUsageFilters({
    computerLabel: activeComputerLabel,
    onRemove,
    runtimeLabel: activeRuntimeLabel,
}: {
    computerLabel?: string;
    onRemove: (key: 'computer' | 'runtime') => void;
    runtimeLabel?: string;
}) {
    return (
        <fieldset className="flex flex-wrap items-center gap-2 px-1">
            <legend className="sr-only">Active usage filters</legend>
            {activeComputerLabel ? (
                <Button onPress={() => onRemove('computer')} size="sm" variant="secondary">
                    Computer: {activeComputerLabel}
                    <Icon aria-hidden="true" icon={Cancel01Icon} size={14} />
                </Button>
            ) : null}
            {activeRuntimeLabel ? (
                <Button onPress={() => onRemove('runtime')} size="sm" variant="secondary">
                    Runtime: {activeRuntimeLabel}
                    <Icon aria-hidden="true" icon={Cancel01Icon} size={14} />
                </Button>
            ) : null}
        </fieldset>
    );
}

function runtimeLabel(runtimeId: string) {
    switch (runtimeId) {
        case 'claude-code':
            return 'Claude Code';
        case 'grok-build':
            return 'Grok Build';
        case 'codex':
            return 'Codex';
        case 'pi':
            return 'Pi';
        default:
            return runtimeId;
    }
}

function TokenUsageSkeleton() {
    return (
        <div aria-busy="true" className="grid gap-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
    );
}

function UsageMessage({ description, title }: { description: string; title: string }) {
    return (
        <Card>
            <Card.Content className="py-10 text-center">
                <p className="font-medium text-base">{title}</p>
                <p className="mt-1 text-muted text-sm">{description}</p>
            </Card.Content>
        </Card>
    );
}
