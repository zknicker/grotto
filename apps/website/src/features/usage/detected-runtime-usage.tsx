import { Button, Card, Chip, Label, ProgressBar, Skeleton, Tooltip } from '@heroui/react';
import type { ComputerRuntimeId, UsageOverview } from '@tavern/api';
import type { ReactNode } from 'react';
import { ProviderMark, type ProviderMarkId } from '../../components/provider-mark.tsx';
import { formatTimestamp } from '../../lib/format.ts';
import {
    type DisplayPlanWindow,
    selectFirstWindow,
    selectWindow,
    selectWindows,
    usageColor,
} from './runtime-plan-windows.ts';

export function DetectedRuntimeUsage({
    detectedRuntimeIds,
    onViewPiUsage,
    piAgentCount,
    usage,
}: {
    detectedRuntimeIds: ComputerRuntimeId[];
    onViewPiUsage?: () => void;
    piAgentCount: number | null;
    usage: UsageOverview;
}) {
    const detectedRuntimeSet = new Set(detectedRuntimeIds);

    return (
        <div className="@container">
            {detectedRuntimeIds.length > 0 ? (
                <div className="grid auto-rows-fr @xl:grid-cols-2 grid-cols-1 gap-3">
                    {detectedRuntimeSet.has('codex') ? (
                        <CodexUsageCard state={usage.codex} />
                    ) : null}
                    {detectedRuntimeSet.has('claude-code') ? (
                        <ClaudeUsageCard planState={usage.claude} />
                    ) : null}
                    {detectedRuntimeSet.has('grok-build') ? (
                        <GrokUsageCard planState={usage.grok} />
                    ) : null}
                    {detectedRuntimeSet.has('pi') ? (
                        <PiUsageCard agentCount={piAgentCount} onViewUsage={onViewPiUsage} />
                    ) : null}
                </div>
            ) : (
                <p className="text-muted text-sm">No runtimes detected.</p>
            )}
        </div>
    );
}

export function DetectedRuntimeUsageSkeleton({
    detectedRuntimeIds,
}: {
    detectedRuntimeIds: ComputerRuntimeId[];
}) {
    return (
        <div className="@container">
            {detectedRuntimeIds.length > 0 ? (
                <div className="grid auto-rows-fr @xl:grid-cols-2 grid-cols-1 gap-3">
                    {detectedRuntimeIds.map((runtimeId) => (
                        <Skeleton className="h-36 w-full rounded-xl" key={runtimeId} />
                    ))}
                </div>
            ) : (
                <p className="text-muted text-sm">No runtimes detected.</p>
            )}
        </div>
    );
}

function CodexUsageCard({ state }: { state: UsageOverview['codex'] }) {
    const weeklyWindow =
        state.status === 'ok'
            ? selectFirstWindow(
                  state.snapshot.windows,
                  ['current-week', 'current-session'],
                  'Weekly Limit'
              )
            : null;
    return (
        <ProviderCapacityCard provider="codex" title="Codex">
            <PlanUsage
                emptyMessage="Plan limits unavailable"
                windows={weeklyWindow ? [weeklyWindow] : []}
            />
        </ProviderCapacityCard>
    );
}

function ClaudeUsageCard({ planState }: { planState: UsageOverview['claude'] }) {
    const fiveHourWindow =
        planState.status === 'ok'
            ? selectWindow(planState.snapshot.windows, 'current-session', '5h')
            : null;
    const windows =
        planState.status === 'ok'
            ? selectWindows(planState.snapshot.windows, [
                  ['current-week-all-models', 'Weekly Limit'],
              ])
            : [];
    return (
        <ProviderCapacityCard
            provider="claude-code"
            secondary={fiveHourWindow ? <FiveHourUsageChip window={fiveHourWindow} /> : null}
            title="Claude Code"
        >
            <PlanUsage emptyMessage="Plan limits unavailable" windows={windows} />
        </ProviderCapacityCard>
    );
}

function GrokUsageCard({ planState }: { planState: UsageOverview['grok'] }) {
    const windows =
        planState.status === 'ok'
            ? planState.snapshot.windows
                  .filter((window) => window.label === 'Weekly Limit')
                  .map((window) => ({ ...window, label: window.label }))
            : [];
    return (
        <ProviderCapacityCard provider="grok-build" title="Grok Build">
            <PlanUsage emptyMessage="Weekly limit unavailable" windows={windows} />
        </ProviderCapacityCard>
    );
}

function PiUsageCard({
    agentCount,
    onViewUsage,
}: {
    agentCount: number | null;
    onViewUsage?: () => void;
}) {
    return (
        <ProviderCapacityCard provider="pi" title="Pi">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="grid gap-1">
                    <p className="font-medium text-sm">API-backed runtime</p>
                    <p className="text-muted text-xs">
                        {agentCount === null
                            ? 'Usage tracked automatically'
                            : agentCount === 0
                              ? 'Ready · No Agents using Pi'
                              : `${agentCount} ${agentCount === 1 ? 'Agent' : 'Agents'} · Usage tracked automatically`}
                    </p>
                </div>
                {onViewUsage ? (
                    <Button onPress={onViewUsage} size="sm" variant="secondary">
                        View usage
                    </Button>
                ) : null}
            </div>
        </ProviderCapacityCard>
    );
}

function ProviderCapacityCard({
    children,
    provider,
    secondary,
    title,
}: {
    children: ReactNode;
    provider: ProviderMarkId;
    secondary?: ReactNode;
    title: string;
}) {
    return (
        <Card className="h-full">
            <Card.Header className="flex-row items-start gap-3">
                <Card.Title className={secondary ? 'min-w-0 pe-20 text-base' : 'min-w-0 text-base'}>
                    <span className="flex min-w-0 items-center gap-2">
                        <ProviderMark provider={provider} />
                        <span className="truncate">{title}</span>
                    </span>
                </Card.Title>
                {secondary ? <div className="absolute end-4 top-4">{secondary}</div> : null}
            </Card.Header>
            <Card.Content className="justify-end">{children}</Card.Content>
        </Card>
    );
}

function FiveHourUsageChip({ window }: { window: DisplayPlanWindow }) {
    const resetCopy = window.resetsAt
        ? ` Resets ${formatTimestamp(window.resetsAt)}.`
        : ' Reset time unavailable.';
    return (
        <Tooltip delay={300}>
            <Tooltip.Trigger
                aria-label={`5-hour limit, ${window.usedPercent}% used.`}
                className="flex"
            >
                <Chip
                    className="shrink-0 tabular-nums"
                    color={usageColor(window.usedPercent)}
                    size="sm"
                    variant="soft"
                >
                    5h · {Math.round(window.usedPercent)}%
                </Chip>
            </Tooltip.Trigger>
            <Tooltip.Content placement="top" showArrow>
                <Tooltip.Arrow />
                <p>
                    5-hour window. {Math.round(window.usedPercent)}% used.{resetCopy}
                </p>
            </Tooltip.Content>
        </Tooltip>
    );
}

function PlanUsage({
    emptyMessage,
    windows,
}: {
    emptyMessage: string;
    windows: DisplayPlanWindow[];
}) {
    if (windows.length === 0) {
        return <p className="text-muted text-sm">{emptyMessage}</p>;
    }
    return (
        <div className="grid gap-4">
            {windows.map((window) => (
                <div className="grid gap-1" key={window.id}>
                    <ProgressBar
                        aria-label={window.label}
                        color={window.usedPercent >= 90 ? 'danger' : 'accent'}
                        value={window.usedPercent}
                    >
                        <Label>{window.label}</Label>
                        <ProgressBar.Output />
                        <ProgressBar.Track>
                            <ProgressBar.Fill />
                        </ProgressBar.Track>
                    </ProgressBar>
                    {window.resetsAt ? (
                        <p className="text-muted text-xs">
                            Resets {formatTimestamp(window.resetsAt)}
                        </p>
                    ) : null}
                </div>
            ))}
        </div>
    );
}
