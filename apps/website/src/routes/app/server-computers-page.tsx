import { ComputerIcon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Empty, EmptyDescription, EmptyHeader } from '../../components/ui/empty.tsx';
import { EmptyState } from '../../components/ui/empty-state.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { navSelectedClass } from '../../components/ui/nav.tsx';
import { SidePane } from '../../components/ui/pane.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { AddComputerDialog } from '../../features/computers/add-computer-dialog.tsx';
import {
    ComputerDetail,
    computerHealthLabel,
    computerHealthStatus,
} from '../../features/computers/computer-detail.tsx';
import { computerLabel } from '../../features/computers/presentation.ts';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { RequireOperator } from '../../features/servers/require-operator.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { cn } from '../../lib/utils.ts';
import { HostedDeleteDialog } from './hosted-delete-dialog.tsx';

/** Server-owned Computer inventory backed by persisted reports and the live attachment socket. */
export function ServerComputersPage() {
    const { slug = '' } = useParams();
    const { agents, server } = useHostedServerContext();
    const computers = grottoTrpc.computer.list.useQuery({ serverId: server.id }, { enabled: true });
    const [searchParams, setSearchParams] = useSearchParams();
    const [removing, setRemoving] = React.useState<string | null>(null);
    const [adding, setAdding] = React.useState(false);
    const utils = grottoTrpc.useUtils();
    const remove = grottoTrpc.computer.remove.useMutation({
        onSuccess: () => {
            setRemoving(null);
            void utils.computer.list.invalidate({ serverId: server.id });
        },
    });

    const items = computers.data ?? [];
    const selectedId = searchParams.get('computer');
    const selected = items.find((computer) => computer.id === selectedId) ?? items[0] ?? null;

    return (
        <RequireOperator
            description="Computers are attached and removed by Server operators."
            role={server.role}
        >
            <div className="flex h-full min-h-0 w-full">
                <SidePane
                    className="app-shell-sidebar-top-inset w-72 flex-col bg-sidebar"
                    side="left"
                >
                    <div className="mb-2 flex items-center justify-between px-3">
                        <h1 className="flex items-center gap-2 font-mono text-sidebar-muted text-xs uppercase tracking-wider">
                            <span>Computers</span>
                            <span className="tabular-nums">{items.length}</span>
                        </h1>
                        <Button
                            aria-label="Add Computer"
                            onClick={() => setAdding(true)}
                            size="icon-sm"
                            title="Add Computer"
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" icon={PlusSignIcon} />
                        </Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        {items.map((computer) => (
                            <button
                                className={cn(
                                    'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm',
                                    selected?.id === computer.id
                                        ? navSelectedClass
                                        : 'hover:bg-[var(--nav-hover)]'
                                )}
                                key={computer.id}
                                onClick={() => setSearchParams({ computer: computer.id })}
                                type="button"
                            >
                                <Icon
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                    icon={ComputerIcon}
                                />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate font-medium">
                                        {computerLabel(computer)}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
                                        <StatusDot status={computerHealthStatus(computer.health)} />
                                        {computerHealthLabel(computer.health)} · v
                                        {computer.productVersion ?? '—'}
                                    </span>
                                </span>
                            </button>
                        ))}
                        {items.length === 0 ? (
                            <Empty className="px-3 py-10 md:py-10">
                                <EmptyHeader>
                                    <EmptyDescription size="sm">
                                        No Computers attached.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        ) : null}
                    </div>
                </SidePane>
                <main className="min-w-0 flex-1 overflow-y-auto">
                    {selected ? (
                        <ComputerDetail
                            agents={agents.filter((agent) => agent.computerId === selected.id)}
                            computer={selected}
                            onRemove={() => setRemoving(selected.id)}
                            serverId={server.id}
                            serverSlug={slug}
                        />
                    ) : (
                        <EmptyState
                            className="min-h-full"
                            description="Computers run Agents and keep their workspaces, runtime access, and execution state on your machine."
                            title="Attach a Computer"
                        />
                    )}
                </main>
                <AddComputerDialog onOpenChange={setAdding} open={adding} serverSlug={slug} />
                {removing ? (
                    <HostedDeleteDialog
                        confirmation="REMOVE"
                        description="This immediately revokes this Computer’s credential. Delete every Agent on this Computer first."
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
        </RequireOperator>
    );
}
