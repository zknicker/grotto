import { ItemCardGroup } from '@heroui-pro/react';
import type { ComputerRuntimeId } from '@tavern/api';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { PageColumn } from '../shell/page-column.tsx';
import { ComputerUsageCapacity } from '../usage/computer-usage-capacity.tsx';
import { ComputerActions } from './computer-actions.tsx';
import { ComputerAgents } from './computer-agents.tsx';
import { computerRuntimePresentations, computerSystemLabel } from './presentation.ts';

export function ComputerDetail({
    computerId,
    onRemove,
    serverId,
    serverSlug,
}: {
    computerId: string;
    onRemove: () => void;
    serverId: string;
    serverSlug: string;
}) {
    const computers = useComputers(serverId);
    const computer = computers.data?.find((candidate) => candidate.id === computerId);

    if (!computer) {
        return null;
    }

    const runtimes = computerRuntimePresentations(computer.reportedInventory);
    const detectedRuntimeIds = runtimes
        .filter(
            (
                runtime
            ): runtime is typeof runtime & {
                id: ComputerRuntimeId;
            } => runtime.detected && isComputerRuntimeId(runtime.id)
        )
        .map((runtime) => runtime.id);
    const undetectedRuntimeLabels = runtimes
        .filter((runtime) => !runtime.detected)
        .map((runtime) => runtime.label);

    return (
        <PageColumn width="wide">
            {/* Version and connection state live in the shell band; what is
                    left is stable background detail, which reads better as one
                    line than as four icon rows. */}
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <ComputerFact srLabel="System" value={computerSystemLabel(computer)} />
                <ComputerFact
                    label="Last connected"
                    value={
                        computer.lastConnectedAt
                            ? formatTimestamp(computer.lastConnectedAt)
                            : 'Never'
                    }
                />
                <ComputerFact label="Added" value={formatDate(computer.createdAt)} />
            </dl>

            <section>
                <ItemCardGroup variant="transparent">
                    <ItemCardGroup.Header className="flex items-baseline justify-between gap-3">
                        <ItemCardGroup.Title>Runtimes</ItemCardGroup.Title>
                        {undetectedRuntimeLabels.length > 0 ? (
                            // A runtime with nothing installed has no limit and no
                            // reset, so it rides in the section header rather than
                            // claiming a data row or a line below the table.
                            <p className="min-w-0 truncate text-muted text-sm">
                                Not detected: {undetectedRuntimeLabels.join(', ')}
                            </p>
                        ) : null}
                    </ItemCardGroup.Header>
                    <ComputerUsageCapacity
                        computerId={computerId}
                        detectedRuntimeIds={detectedRuntimeIds}
                        serverId={serverId}
                        serverSlug={serverSlug}
                    />
                </ItemCardGroup>
            </section>

            <ComputerAgents computerId={computerId} serverId={serverId} serverSlug={serverSlug} />
            <ComputerActions
                computerId={computerId}
                onRemove={onRemove}
                serverId={serverId}
                serverSlug={serverSlug}
            />
        </PageColumn>
    );
}

function ComputerFact({ label, srLabel, value }: ComputerFactProps) {
    return (
        <div className="flex min-w-0 items-baseline gap-1.5">
            <dt className={label ? 'text-muted' : 'sr-only'}>{label ?? srLabel}</dt>
            <dd className="truncate text-foreground">{value}</dd>
        </div>
    );
}

interface ComputerFactProps {
    label?: string;
    srLabel?: string;
    value: string;
}

function isComputerRuntimeId(value: string): value is ComputerRuntimeId {
    return value === 'codex' || value === 'claude-code' || value === 'grok-build' || value === 'pi';
}

function formatTimestamp(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function formatDate(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
