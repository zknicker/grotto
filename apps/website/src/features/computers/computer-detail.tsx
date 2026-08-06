import { ComputerIcon } from '@hugeicons-pro/core-stroke-rounded';
import { ModelProviderBadge } from '../../components/badges/model-provider-badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { getModelProviderConfig } from '../../lib/model-provider-config.ts';
import { ComputerActions } from './computer-actions.tsx';
import { ComputerAgents } from './computer-agents.tsx';
import {
    computerHealthLabel,
    computerHealthStatus,
    computerLabel,
    computerRuntimePresentations,
    computerSystemLabel,
} from './presentation.ts';

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

    return (
        <div className="w-full pb-8">
            <header className="flex h-10 items-center gap-2 border-separator border-b px-5 sm:px-7">
                <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted"
                    icon={ComputerIcon}
                />
                <h1 className="min-w-0 truncate font-semibold text-sm">
                    {computerLabel(computer)}
                </h1>
                <p className="ms-auto flex shrink-0 items-center gap-1.5 text-muted text-xs">
                    <StatusDot status={computerHealthStatus(computer.health)} />
                    {computerHealthLabel(computer.health)}
                </p>
            </header>

            <div className="px-5 sm:px-7">
                <section className="grid gap-4 py-5">
                    <h2 className="font-medium text-muted text-sm">Info</h2>
                    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Fact label="System" value={computerSystemLabel(computer)} />
                        <Fact
                            label="Computer version"
                            value={computer.productVersion ? `v${computer.productVersion}` : '—'}
                        />
                        <Fact
                            label="Last connected"
                            value={
                                computer.lastConnectedAt
                                    ? formatTimestamp(computer.lastConnectedAt)
                                    : 'Never'
                            }
                        />
                        <Fact label="Created" value={formatDate(computer.createdAt)} />
                    </dl>
                    <div className="grid gap-2">
                        <p className="text-muted text-xs">Detected runtimes</p>
                        <div className="flex flex-wrap gap-1.5">
                            {runtimes.map((runtime) => (
                                <RuntimeBadge key={runtime.id} runtime={runtime} />
                            ))}
                        </div>
                    </div>
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

function RuntimeBadge({
    runtime,
}: {
    runtime: ReturnType<typeof computerRuntimePresentations>[number];
}) {
    const provider = getModelProviderConfig(runtime.id);
    const state = runtime.detected ? 'Detected' : 'Not detected';

    return (
        <ModelProviderBadge
            aria-label={`${runtime.label}: ${state}`}
            className={runtime.detected ? undefined : 'opacity-50 grayscale'}
            color={provider.color}
            icon={provider.icon}
            label={runtime.detected ? runtime.label : `${runtime.label} · Not detected`}
            logo={provider.logo}
            size="sm"
            title={
                runtime.detected
                    ? runtime.models.map((model) => model.label).join(', ') || 'No models reported'
                    : `${runtime.label} is supported but was not detected on this Computer.`
            }
        />
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1">
            <dt className="text-muted text-xs">{label}</dt>
            <dd className="font-medium text-foreground text-sm">{value}</dd>
        </div>
    );
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
