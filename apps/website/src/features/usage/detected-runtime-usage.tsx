import { Button, ProgressBar, Skeleton, Tooltip } from '@heroui/react';
import { DataGrid, type DataGridColumn } from '@heroui-pro/react';
import type { ComputerRuntimeId, UsageOverview } from '@tavern/api';
import { ProviderMark } from '../../components/provider-mark.tsx';
import { formatTimestamp } from '../../lib/format.ts';
import {
    type DisplayPlanWindow,
    selectFirstWindow,
    selectWindow,
    selectWindows,
    usageColor,
} from './runtime-plan-windows.ts';

interface RuntimeUsageRow {
    fiveHourWindow: DisplayPlanWindow | null;
    id: ComputerRuntimeId;
    status: string;
    title: string;
    window: DisplayPlanWindow | null;
}

/**
 * Runtimes render through the same DataGrid as Agents on this Computer, so the
 * two tables on the page share one header, surface, and row treatment instead of
 * reading as unrelated widgets. The grid carries detected runtimes only;
 * undetected ones are named in the section header, since they have no limit and
 * no reset to put in a row.
 */
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
    const detected = new Set(detectedRuntimeIds);
    const rows = runtimeOrder
        .filter((id) => detected.has(id))
        .map((id) => buildRuntimeRow(id, usage, piAgentCount));

    if (rows.length === 0) {
        return <p className="text-muted text-sm">No runtimes detected.</p>;
    }

    return (
        <DataGrid
            aria-label="Runtimes on this Computer"
            columns={runtimeColumns(onViewPiUsage)}
            contentClassName="min-w-160"
            data={rows}
            getRowId={(item) => item.id}
        />
    );
}

export function DetectedRuntimeUsageSkeleton({
    detectedRuntimeIds,
}: {
    detectedRuntimeIds: ComputerRuntimeId[];
}) {
    if (detectedRuntimeIds.length === 0) {
        return <p className="text-muted text-sm">No runtimes detected.</p>;
    }

    return (
        <div aria-busy="true" className="grid gap-2">
            <span className="sr-only">Loading runtime usage</span>
            {detectedRuntimeIds.map((runtimeId) => (
                <Skeleton className="h-11 w-full rounded-xl" key={runtimeId} />
            ))}
        </div>
    );
}

function runtimeColumns(onViewPiUsage?: () => void): DataGridColumn<RuntimeUsageRow>[] {
    return [
        {
            cell: (item) => (
                <div className="flex min-w-0 items-center gap-3">
                    <ProviderMark className="size-5 shrink-0 text-muted" provider={item.id} />
                    <p className="truncate font-medium text-base">{item.title}</p>
                </div>
            ),
            header: 'Runtime',
            headerClassName: 'text-sm',
            id: 'runtime',
            isRowHeader: true,
            minWidth: 180,
        },
        {
            cell: (item) =>
                item.window ? (
                    <UsageMeter label={`${item.title} ${item.window.label}`} window={item.window} />
                ) : (
                    <span className="truncate text-muted text-sm">{item.status}</span>
                ),
            header: 'Weekly limit',
            headerClassName: 'text-sm',
            id: 'limit',
            minWidth: 240,
        },
        {
            // The burst window gets its own track. Inline beside the weekly meter
            // it stole width from one row's bar, which made the bars stop being
            // comparable.
            cell: (item) =>
                item.fiveHourWindow ? (
                    <Tooltip delay={300}>
                        <Tooltip.Trigger
                            aria-label={`5-hour limit, ${Math.round(item.fiveHourWindow.usedPercent)}% used.`}
                            className="flex w-full min-w-0"
                        >
                            <UsageMeter
                                label={`${item.title} 5-hour limit`}
                                window={item.fiveHourWindow}
                            />
                        </Tooltip.Trigger>
                        <Tooltip.Content showArrow>
                            <Tooltip.Arrow />
                            <p className="max-w-xs">{burstResetCopy(item.fiveHourWindow)}</p>
                        </Tooltip.Content>
                    </Tooltip>
                ) : (
                    <UnsupportedMeter />
                ),
            header: '5h limit',
            headerClassName: 'text-sm',
            id: 'burst',
            minWidth: 190,
        },
        {
            align: 'end',
            cell: (item) => {
                if (item.window?.resetsAt) {
                    return (
                        <span className="text-muted text-sm">
                            Resets {formatTimestamp(item.window.resetsAt)}
                        </span>
                    );
                }
                return item.id === 'pi' && onViewPiUsage ? (
                    <Button className="-my-1" onPress={onViewPiUsage} size="sm" variant="ghost">
                        View usage
                    </Button>
                ) : null;
            },
            header: 'Resets',
            headerClassName: 'text-sm',
            id: 'resets',
            minWidth: 150,
        },
    ];
}

function UsageMeter({ label, window }: { label: string; window: DisplayPlanWindow }) {
    return (
        <div className="flex w-full min-w-0 items-center gap-3">
            <ProgressBar
                aria-label={label}
                className="min-w-12 flex-1"
                // The bar used its own inline threshold while the shared helper
                // defines a warning tier at 75%, so a 75% week looked as calm as a
                // 7% one. One scale for every meter.
                color={usageColor(window.usedPercent)}
                value={window.usedPercent}
            >
                <ProgressBar.Track>
                    <ProgressBar.Fill />
                </ProgressBar.Track>
            </ProgressBar>
            <span className="w-10 shrink-0 text-right font-medium text-sm tabular-nums">
                {Math.round(window.usedPercent)}%
            </span>
        </div>
    );
}

/**
 * A runtime with no burst window keeps the meter's geometry so the column still
 * reads as one row of bars, but renders an inert track rather than a zero-value
 * ProgressBar — a 0% bar would announce "0%" and imply a limit that does not
 * exist. The track class comes from the design system, so it tracks the theme.
 */
function UnsupportedMeter() {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <div aria-hidden="true" className="progress-bar__track min-w-12 flex-1 opacity-40" />
            <span className="w-10 shrink-0 text-right text-muted text-sm">—</span>
            <span className="sr-only">No 5-hour limit</span>
        </div>
    );
}

function buildRuntimeRow(
    id: ComputerRuntimeId,
    usage: UsageOverview,
    piAgentCount: number | null
): RuntimeUsageRow {
    const title = runtimeLabels[id];

    if (id === 'codex') {
        return {
            fiveHourWindow: null,
            id,
            status: 'Plan limits unavailable',
            title,
            window:
                usage.codex.status === 'ok'
                    ? selectFirstWindow(
                          usage.codex.snapshot.windows,
                          ['current-week', 'current-session'],
                          'Weekly Limit'
                      )
                    : null,
        };
    }

    if (id === 'claude-code') {
        return {
            fiveHourWindow:
                usage.claude.status === 'ok'
                    ? selectWindow(usage.claude.snapshot.windows, 'current-session', '5h')
                    : null,
            id,
            status: 'Plan limits unavailable',
            title,
            window:
                usage.claude.status === 'ok'
                    ? (selectWindows(usage.claude.snapshot.windows, [
                          ['current-week-all-models', 'Weekly Limit'],
                      ])[0] ?? null)
                    : null,
        };
    }

    if (id === 'grok-build') {
        return {
            fiveHourWindow: null,
            id,
            status: 'Weekly limit unavailable',
            title,
            window:
                usage.grok.status === 'ok'
                    ? (usage.grok.snapshot.windows.find(
                          (candidate) => candidate.label === 'Weekly Limit'
                      ) ?? null)
                    : null,
        };
    }

    return { fiveHourWindow: null, id, status: piAgentSummary(piAgentCount), title, window: null };
}

function burstResetCopy(window: DisplayPlanWindow) {
    const used = `Rolling 5-hour limit, ${Math.round(window.usedPercent)}% used.`;
    return window.resetsAt
        ? `${used} Resets ${formatTimestamp(window.resetsAt)}.`
        : `${used} Reset time unavailable.`;
}

function piAgentSummary(agentCount: number | null) {
    if (agentCount === null) {
        return 'API-backed · Usage tracked automatically';
    }
    return agentCount === 0
        ? 'API-backed · No Agents using Pi'
        : `API-backed · ${agentCount} ${agentCount === 1 ? 'Agent' : 'Agents'}`;
}

const runtimeOrder: ComputerRuntimeId[] = ['codex', 'claude-code', 'grok-build', 'pi'];

const runtimeLabels: Record<ComputerRuntimeId, string> = {
    'claude-code': 'Claude Code',
    codex: 'Codex',
    'grok-build': 'Grok Build',
    pi: 'Pi',
};
