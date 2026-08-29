import { Button, Skeleton } from '@heroui/react';
import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { useUsage } from '../../hooks/servers/use-usage.ts';
import { computerLabel } from '../computers/presentation.ts';
import { PageColumn } from '../shell/page-column.tsx';
import { SectionHeader } from '../shell/section-header.tsx';
import { PageTopbar } from '../shell/shell-topbar.tsx';
import { AgentUsageScopePicker } from '../stats/agent-usage-scope.tsx';
import { TokenUsageDashboard, TokenUsageRangePicker } from '../stats/token-usage-module.tsx';
import { buildTokenUsageView, type TokenUsageRange } from '../stats/token-usage-view.ts';
import { UsageEmptyCard } from './usage-empty.tsx';

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
    const [days, setDays] = useState<TokenUsageRange>(30);
    const [selectedAgentId, setSelectedAgentId] = useState<null | string>(null);
    const tokenUsage = usage.data?.tokenUsage;
    const view = useMemo(
        () =>
            tokenUsage && !isFilterPending
                ? buildTokenUsageView(tokenUsage, days, selectedAgentId, new Date(), scope)
                : null,
        [days, isFilterPending, scope, selectedAgentId, tokenUsage]
    );

    return (
        <>
            {/* Reached from the Server menu rather than the rail, so the band
                names the destination. Scope and range stay in the column with
                the cards they filter: the 3rem band fits compact chrome only
                (Select has no compact size), and in the band they hug the
                window edge instead of the content's own margins. */}
            <PageTopbar>
                <SectionHeader title="Usage" />
            </PageTopbar>
            <PageColumn>
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
                ) : view ? (
                    <TokenUsageDashboard
                        controls={
                            <>
                                {view.agents.length > 0 ? (
                                    <AgentUsageScopePicker
                                        agents={view.agents}
                                        onSelect={setSelectedAgentId}
                                        selectedAgentId={view.selectedAgent?.agentId ?? null}
                                    />
                                ) : null}
                                <TokenUsageRangePicker days={days} onChange={setDays} />
                            </>
                        }
                        emptyMessage={
                            runtimeId === 'pi'
                                ? 'Usage will appear after a Pi Agent completes a model turn.'
                                : undefined
                        }
                        view={view}
                    />
                ) : usage.data ? (
                    <UsageEmptyCard
                        description="Usage will appear after an Agent completes a model turn."
                        title="No Agent Usage Yet"
                    />
                ) : usage.error ? (
                    <UsageEmptyCard description={usage.error.message} title="Usage Unavailable" />
                ) : (
                    <TokenUsageSkeleton />
                )}
            </PageColumn>
        </>
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
