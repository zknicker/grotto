import { Button } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { ComputerIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { AddComputerDialog } from './add-computer-dialog.tsx';
import { ComputerDetail } from './computer-detail.tsx';
import { resolveComputerPageState } from './computer-page-state.ts';
import { ComputerRemoveDialog } from './computer-remove-dialog.tsx';

export function ComputerPage({ serverId, serverSlug }: { serverId: string; serverSlug: string }) {
    const computers = useComputers(serverId);
    const [searchParams] = useSearchParams();
    const [adding, setAdding] = React.useState(false);
    const [removingId, setRemovingId] = React.useState<string | null>(null);
    const state = resolveComputerPageState({
        computers: computers.data,
        requestedId: searchParams.get('computer'),
    });

    return (
        <div className="flex h-full min-h-0 w-full">
            <main className="min-w-0 flex-1 overflow-y-auto">
                {computers.error && !computers.data ? (
                    <ComputerUnavailable />
                ) : state.status === 'loading' ? (
                    <ComputerPending />
                ) : state.status === 'ready' ? (
                    <ComputerDetail
                        computerId={state.computerId}
                        onRemove={() => setRemovingId(state.computerId)}
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

function ComputerPending() {
    return (
        <div aria-busy="true" className="min-h-full">
            <span className="sr-only">Loading Computers</span>
        </div>
    );
}

function ComputerUnavailable() {
    return (
        <div className="flex min-h-full items-center justify-center p-6 text-center">
            <div>
                <h2 className="font-medium text-foreground text-sm">Computers unavailable</h2>
                <p className="mt-1 text-muted text-sm">Try opening this page again.</p>
            </div>
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
