import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/primitives/button.tsx';
import { ComputerUpdateControls } from '../../features/servers/computer-update-controls.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import type { GrottoOutputs } from '../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { HostedDeleteDialog } from './hosted-delete-dialog.tsx';

type Computer = GrottoOutputs['computer']['list'][number];

/** Server-owned Computer inventory backed by persisted reports and the live attachment socket. */
export function ServerComputersPage() {
    const { slug = '' } = useParams();
    const { agents, server } = useHostedServerContext();
    const computers = grottoTrpc.computer.list.useQuery({ serverId: server.id }, { enabled: true });
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [removing, setRemoving] = React.useState<string | null>(null);
    const utils = grottoTrpc.useUtils();
    const remove = grottoTrpc.computer.remove.useMutation({
        onSuccess: () => {
            setRemoving(null);
            void utils.computer.list.invalidate({ serverId: server.id });
        },
    });

    if (server.role === 'member') {
        return (
            <main className="grid h-full place-content-center text-muted-foreground text-sm">
                Owner or Admin required.
            </main>
        );
    }

    const items = computers.data ?? [];
    const selected = items.find((computer) => computer.id === selectedId) ?? items[0] ?? null;

    return (
        <div className="flex h-full min-h-0 w-full">
            <aside className="flex w-72 shrink-0 flex-col border-border border-r bg-sidebar pt-[var(--topbar-height)]">
                <div className="flex h-12 items-center justify-between border-border border-b px-4">
                    <div className="font-semibold text-sm">
                        Computers <span className="text-muted-foreground">{items.length}</span>
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {items.map((computer) => (
                        <button
                            className={`flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm ${
                                selected?.id === computer.id
                                    ? 'bg-secondary shadow-[0_2px_0_0_var(--hard-shadow)] ring-1 ring-input ring-inset'
                                    : 'hover:bg-[var(--nav-hover)]'
                            }`}
                            key={computer.id}
                            onClick={() => setSelectedId(computer.id)}
                            type="button"
                        >
                            <span className="font-medium">{computerLabel(computer)}</span>
                            <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                <span
                                    className={`size-2 rounded-full ${
                                        computer.health === 'healthy'
                                            ? 'bg-success'
                                            : computer.health === 'offline'
                                              ? 'bg-muted-foreground'
                                              : 'bg-warning'
                                    }`}
                                />
                                {healthLabel(computer.health)} · v{computer.productVersion ?? '—'}
                            </span>
                        </button>
                    ))}
                    {items.length === 0 ? (
                        <p className="px-3 py-4 text-muted-foreground text-sm">
                            No Computers attached.
                        </p>
                    ) : null}
                </div>
                <div className="border-border border-t p-4">
                    <p className="text-muted-foreground text-xs">
                        Add one from an Apple Silicon Mac:
                    </p>
                    <code className="mt-1 block break-all text-xs">
                        grotto-computer setup /{slug}
                    </code>
                </div>
            </aside>
            <main className="min-w-0 flex-1 overflow-y-auto pt-[var(--topbar-height)]">
                {selected ? (
                    <ComputerDetail
                        agents={agents.filter((agent) => agent.computerId === selected.id)}
                        computer={selected}
                        onRemove={() => setRemoving(selected.id)}
                        serverId={server.id}
                        serverSlug={slug}
                    />
                ) : (
                    <div className="grid min-h-full place-content-center px-6 text-center">
                        <h1 className="font-semibold text-lg">Attach a Computer</h1>
                        <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                            Computers run Agents and keep their workspaces, skills, connections, and
                            execution credentials local.
                        </p>
                    </div>
                )}
            </main>
            {removing ? (
                <HostedDeleteDialog
                    confirmation="REMOVE"
                    description="This immediately revokes this Computer’s credential. It cannot be removed while any Agent is assigned to it."
                    onConfirm={() =>
                        remove.mutate({
                            computerId: removing,
                            confirmation: 'REMOVE',
                            serverId: server.id,
                        })
                    }
                    onOpenChange={(open) => !open && setRemoving(null)}
                    pending={remove.isPending}
                    title="Remove Computer"
                />
            ) : null}
        </div>
    );
}

function ComputerDetail({
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
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
            <header>
                <h1 className="font-semibold text-foreground text-xl">{computerLabel(computer)}</h1>
                <p className="mt-1 flex items-center gap-2 text-muted-foreground text-sm">
                    <span
                        className={`size-2 rounded-full ${
                            computer.health === 'healthy'
                                ? 'bg-success'
                                : computer.health === 'offline'
                                  ? 'bg-muted-foreground'
                                  : 'bg-warning'
                        }`}
                    />
                    {healthLabel(computer.health)}
                    {computer.lastConnectedAt
                        ? ` · Last connected ${formatTimestamp(computer.lastConnectedAt)}`
                        : ''}
                </p>
            </header>

            <DetailSection title="Info">
                <DetailRow
                    label="OS"
                    value={
                        [computer.operatingSystem, computer.architecture]
                            .filter(Boolean)
                            .join(' · ') || 'Awaiting first report'
                    }
                />
                <DetailRow label="Computer version" value={`v${computer.productVersion ?? '—'}`} />
                <DetailRow label="Protocol" value={computer.protocolVersion?.toString() ?? '—'} />
            </DetailSection>

            <DetailSection title="Detected Agent runtimes">
                {computer.reportedInventory?.runtimes.length ? (
                    computer.reportedInventory.runtimes.map((runtime) => (
                        <DetailRow
                            key={runtime.id}
                            label={runtime.label}
                            value={
                                runtime.models.map((model) => model.label).join(', ') ||
                                'No models reported'
                            }
                        />
                    ))
                ) : (
                    <p className="p-4 text-muted-foreground text-sm">No runtimes reported yet.</p>
                )}
            </DetailSection>

            <DetailSection title="Assigned Agents">
                {agents.length > 0 ? (
                    agents.map((agent) => (
                        <DetailRow
                            key={agent.id}
                            label={agent.displayName}
                            value={`${agent.availability} · ${agent.desiredRuntimeId} · ${agent.desiredModelId}`}
                        />
                    ))
                ) : (
                    <p className="p-4 text-muted-foreground text-sm">No Agents assigned.</p>
                )}
            </DetailSection>

            <DetailSection title="Updates">
                <div className="p-4">
                    <ComputerUpdateControls computer={computer} serverId={serverId} />
                </div>
            </DetailSection>

            <DetailSection title="Recovery">
                <div className="space-y-2 p-4 text-sm">
                    <p className="text-muted-foreground">
                        If the App and this Computer disagree, check the machine directly:
                    </p>
                    <code className="block">grotto-computer status</code>
                    <code className="block">grotto-computer doctor</code>
                    <code className="block">grotto-computer restart /{serverSlug}</code>
                </div>
            </DetailSection>

            <DetailSection title="Danger zone">
                <div className="flex items-center justify-between gap-4 p-4">
                    <div>
                        <p className="font-medium text-sm">Remove Computer</p>
                        <p className="text-muted-foreground text-xs">
                            Every assigned Agent must be deleted first.
                        </p>
                    </div>
                    <Button onClick={onRemove} type="button" variant="destructive">
                        Remove Computer
                    </Button>
                </div>
            </DetailSection>
        </div>
    );
}

function DetailSection({ children, title }: React.PropsWithChildren<{ title: string }>) {
    return (
        <section>
            <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {title}
            </h2>
            <div className="overflow-hidden rounded-lg border border-border">{children}</div>
        </section>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-6 border-border border-b px-4 py-3 last:border-b-0">
            <span className="font-medium text-sm">{label}</span>
            <span className="text-right text-muted-foreground text-sm">{value}</span>
        </div>
    );
}

function computerLabel(computer: Computer) {
    const platform = computer.operatingSystem === 'darwin' ? 'Mac' : computer.operatingSystem;
    return platform
        ? `${platform} · ${computer.id.slice(-6)}`
        : `Computer · ${computer.id.slice(-6)}`;
}

function healthLabel(health: Computer['health']) {
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

function formatTimestamp(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
