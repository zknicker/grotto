import { Button } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { ComputerIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { AddComputerDialog } from './add-computer-dialog.tsx';
import { ComputerDetail } from './computer-detail.tsx';
import { ComputerRemoveDialog } from './computer-remove-dialog.tsx';

export function ComputerPage({ serverId, serverSlug }: { serverId: string; serverSlug: string }) {
    const computers = useComputers(serverId);
    const [searchParams] = useSearchParams();
    const [adding, setAdding] = React.useState(false);
    const [removingId, setRemovingId] = React.useState<string | null>(null);
    const items = computers.data ?? [];
    const requestedId = searchParams.get('computer');
    const selectedId =
        items.find((computer) => computer.id === requestedId)?.id ?? items[0]?.id ?? null;

    return (
        <div className="flex h-full min-h-0 w-full">
            <main className="min-w-0 flex-1 overflow-y-auto">
                {selectedId ? (
                    <ComputerDetail
                        computerId={selectedId}
                        onRemove={() => setRemovingId(selectedId)}
                        serverId={serverId}
                        serverSlug={serverSlug}
                    />
                ) : (
                    <ComputerEmpty onAdd={() => setAdding(true)} />
                )}
            </main>
            <AddComputerDialog onOpenChange={setAdding} open={adding} serverSlug={serverSlug} />
            {removingId ? (
                <ComputerRemoveDialog
                    computerId={removingId}
                    onOpenChange={(open) => !open && setRemovingId(null)}
                    serverId={serverId}
                />
            ) : null}
        </div>
    );
}

function ComputerEmpty({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="flex min-h-full items-center justify-center p-6">
            <EmptyState>
                <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                        <Icon icon={ComputerIcon} />
                    </EmptyState.Media>
                    <EmptyState.Title>Attach a Computer</EmptyState.Title>
                    <EmptyState.Description>
                        Computers run Agents and keep their workspaces, runtime access, and
                        execution state on your machine.
                    </EmptyState.Description>
                </EmptyState.Header>
                <EmptyState.Content>
                    <Button onPress={onAdd}>Add Computer</Button>
                </EmptyState.Content>
            </EmptyState>
        </div>
    );
}
