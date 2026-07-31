import { Button, Chip, Tooltip } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { ComputerIcon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
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
                <aside className="app-shell-sidebar-top-inset flex w-72 shrink-0 flex-col border-separator border-r">
                    <div className="mb-2 flex items-center justify-between gap-2 px-3">
                        <h1 className="flex items-center gap-2 font-medium text-muted text-sm">
                            <span>Computers</span>
                            <Chip size="sm" variant="soft">
                                {items.length}
                            </Chip>
                        </h1>
                        <Tooltip>
                            <Button
                                aria-label="Add Computer"
                                isIconOnly
                                onPress={() => setAdding(true)}
                                size="sm"
                                variant="ghost"
                            >
                                <Icon aria-hidden="true" icon={PlusSignIcon} />
                            </Button>
                            <Tooltip.Content>Add Computer</Tooltip.Content>
                        </Tooltip>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        {items.map((computer) => (
                            <button
                                className={cn(
                                    'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus',
                                    selected?.id === computer.id
                                        ? 'bg-surface-secondary'
                                        : 'hover:bg-surface-secondary'
                                )}
                                key={computer.id}
                                onClick={() => setSearchParams({ computer: computer.id })}
                                type="button"
                            >
                                <Icon
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0 text-muted"
                                    icon={ComputerIcon}
                                />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate font-medium">
                                        {computerLabel(computer)}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-muted text-xs">
                                        <StatusDot status={computerHealthStatus(computer.health)} />
                                        {computerHealthLabel(computer.health)} · v
                                        {computer.productVersion ?? '—'}
                                    </span>
                                </span>
                            </button>
                        ))}
                        {items.length === 0 ? (
                            <p className="px-3 py-10 text-center text-muted text-sm">
                                No Computers attached.
                            </p>
                        ) : null}
                    </div>
                </aside>
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
                        <div className="flex min-h-full items-center justify-center p-6">
                            <EmptyState>
                                <EmptyState.Header>
                                    <EmptyState.Media variant="icon">
                                        <Icon icon={ComputerIcon} />
                                    </EmptyState.Media>
                                    <EmptyState.Title>Attach a Computer</EmptyState.Title>
                                    <EmptyState.Description>
                                        Computers run Agents and keep their workspaces, runtime
                                        access, and execution state on your machine.
                                    </EmptyState.Description>
                                </EmptyState.Header>
                                <EmptyState.Content>
                                    <Button onPress={() => setAdding(true)}>Add Computer</Button>
                                </EmptyState.Content>
                            </EmptyState>
                        </div>
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
