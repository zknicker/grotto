import { Button } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { ComputerIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { AddComputerDialog } from '../../features/computers/add-computer-dialog.tsx';
import { ComputerDetail } from '../../features/computers/computer-detail.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { RequireOperator } from '../../features/servers/require-operator.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { HostedDeleteDialog } from './hosted-delete-dialog.tsx';

/** Server-owned Computer inventory backed by persisted reports and the live attachment socket. */
export function ServerComputersPage() {
    const { slug = '' } = useParams();
    const { agents, server } = useHostedServerContext();
    const computers = grottoTrpc.computer.list.useQuery({ serverId: server.id }, { enabled: true });
    const [searchParams] = useSearchParams();
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
