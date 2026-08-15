import { ItemCardGroup } from '@heroui-pro/react';
import {
    Calendar01Icon,
    ComputerActivityIcon,
    CpuIcon,
    SoftwareIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import type { ComputerRuntimeId } from '@tavern/api';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { ComputerUsageCapacity } from '../usage/computer-usage-capacity.tsx';
import { RuntimeSectionHeader } from '../usage/runtime-section-header.tsx';
import { ComputerActions } from './computer-actions.tsx';
import { ComputerAgents } from './computer-agents.tsx';
import { ComputerInfo } from './computer-info.tsx';
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

    return (
        <div className="w-full pb-8">
            <div className="px-5 sm:px-7">
                <ComputerInfo
                    facts={[
                        {
                            icon: CpuIcon,
                            label: 'System',
                            value: computerSystemLabel(computer),
                        },
                        {
                            icon: SoftwareIcon,
                            label: 'Computer version',
                            value: computer.productVersion ? `v${computer.productVersion}` : '—',
                        },
                        {
                            icon: ComputerActivityIcon,
                            label: 'Last connected',
                            value: computer.lastConnectedAt
                                ? formatTimestamp(computer.lastConnectedAt)
                                : 'Never',
                        },
                        {
                            icon: Calendar01Icon,
                            label: 'Created',
                            value: formatDate(computer.createdAt),
                        },
                    ]}
                />

                <section className="py-5">
                    <ItemCardGroup variant="transparent">
                        <RuntimeSectionHeader detectedRuntimeIds={detectedRuntimeIds} />
                        <ComputerUsageCapacity
                            computerId={computerId}
                            detectedRuntimeIds={detectedRuntimeIds}
                            serverId={serverId}
                            serverSlug={serverSlug}
                        />
                    </ItemCardGroup>
                </section>

                <ComputerAgents
                    computerId={computerId}
                    serverId={serverId}
                    serverSlug={serverSlug}
                />
                <ComputerActions
                    computerId={computerId}
                    onRemove={onRemove}
                    serverId={serverId}
                    serverSlug={serverSlug}
                />
            </div>
        </div>
    );
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
