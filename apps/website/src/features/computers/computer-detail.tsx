import { Button, Disclosure } from '@heroui/react';
import { ComputerIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Link } from 'react-router-dom';
import { ModelProviderBadge } from '../../components/badges/model-provider-badge.tsx';
import { CodeSnippet } from '../../components/code-snippet.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import type { GrottoOutputs } from '../../lib/grotto-server.tsx';
import { getModelProviderConfig } from '../../lib/model-provider-config.ts';
import { HostedAgentFace } from '../members/hosted-agent-face.tsx';
import { ComputerUpdateControls } from '../servers/computer-update-controls.tsx';
import { serverMembersRoute } from '../servers/server-routes.ts';
import {
    agentExecutionLabels,
    availabilityLabel,
    computerLabel,
    computerRuntimePresentations,
    computerSystemLabel,
} from './presentation.ts';

type Computer = GrottoOutputs['computer']['list'][number];

export function ComputerDetail({
    agents,
    computer,
    onRemove,
    serverId,
    serverSlug,
}: {
    agents: GrottoOutputs['agent']['list'];
    computer: Computer;
    onRemove: () => void;
    serverId: string;
    serverSlug: string;
}) {
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

                <section className="grid gap-4 py-5">
                    <h2 className="font-medium text-muted text-sm">
                        Agents on This Computer
                        <span className="ms-2 tabular-nums">{agents.length}</span>
                    </h2>
                    {agents.length > 0 ? (
                        <div className="grid">
                            {agents.map((agent) => (
                                <AgentRow
                                    agent={agent}
                                    inventory={computer.reportedInventory}
                                    key={agent.id}
                                    serverSlug={serverSlug}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted text-sm">No Agents on this Computer.</p>
                    )}
                </section>

                <section className="grid gap-4 py-5">
                    <h2 className="font-medium text-muted text-sm">Actions</h2>
                    <div className="grid gap-5">
                        <ComputerUpdateControls computer={computer} serverId={serverId} />
                        <Disclosure>
                            <Disclosure.Heading>
                                <Button slot="trigger" variant="ghost">
                                    Recovery Commands
                                    <Disclosure.Indicator />
                                </Button>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <div className="grid gap-3">
                                        <p className="text-muted text-sm">
                                            If the App and this Computer disagree, check the machine
                                            directly.
                                        </p>
                                        <CodeSnippet
                                            lines={[
                                                'grotto-computer status',
                                                'grotto-computer doctor',
                                                `grotto-computer restart /${serverSlug}`,
                                                'grotto-computer upgrade --rollback',
                                            ]}
                                        />
                                    </div>
                                </Disclosure.Body>
                            </Disclosure.Content>
                        </Disclosure>
                        <div className="flex flex-col gap-3 border-separator border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="font-medium text-foreground text-sm">
                                    Remove Computer
                                </h3>
                                <p className="text-muted text-sm">
                                    Delete every Agent on this Computer first.
                                </p>
                            </div>
                            <Button onPress={onRemove} size="sm" variant="danger-soft">
                                Remove Computer
                            </Button>
                        </div>
                    </div>
                </section>
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

function AgentRow({
    agent,
    inventory,
    serverSlug,
}: {
    agent: GrottoOutputs['agent']['list'][number];
    inventory: Computer['reportedInventory'];
    serverSlug: string;
}) {
    const execution = agentExecutionLabels(agent, inventory);

    return (
        <Link
            className="flex min-w-0 items-center gap-3 border-separator border-b py-3 outline-none last:border-b-0 hover:bg-surface-secondary focus-visible:bg-surface-secondary"
            to={`${serverMembersRoute(serverSlug)}/agents/${agent.id}`}
        >
            <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center overflow-visible"
            >
                <HostedAgentFace
                    agent={agent}
                    animate={false}
                    size={28}
                    style={{ flexShrink: 0, height: 28, overflow: 'visible', width: 28 }}
                />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                <p className="truncate font-medium text-foreground text-sm">{agent.displayName}</p>
                <p className="truncate text-muted text-xs">
                    {execution.runtime} · {execution.model}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-muted text-xs">
                <StatusDot status={availabilityStatus(agent.availability)} />
                {availabilityLabel(agent.availability)}
            </div>
        </Link>
    );
}

function availabilityStatus(value: GrottoOutputs['agent']['list'][number]['availability']) {
    if (value === 'idle') {
        return 'success' as const;
    }
    if (value === 'working') {
        return 'warning' as const;
    }
    return value === 'error' ? ('error' as const) : ('muted' as const);
}

export function computerHealthLabel(health: Computer['health']) {
    switch (health) {
        case 'healthy':
            return 'Online';
        case 'offline':
            return 'Offline';
        case 'update-required':
            return 'Update required';
        case 'degraded':
            return 'Needs attention';
    }
}

export function computerHealthStatus(health: Computer['health']) {
    return health === 'healthy'
        ? ('success' as const)
        : health === 'offline'
          ? ('muted' as const)
          : ('warning' as const);
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
