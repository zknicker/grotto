import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';

export function HostedAgentSessionSection({
    agent,
    server,
}: {
    agent: HostedAgent;
    server: ServerDetail;
}) {
    const utils = grottoTrpc.useUtils();
    const reset = grottoTrpc.agent.reset.useMutation({
        onSuccess: () =>
            Promise.all([
                utils.agent.deliveryState.invalidate({
                    agentId: agent.id,
                    serverId: server.id,
                }),
                utils.agent.list.invalidate({ serverId: server.id }),
            ]),
    });
    const [fullResetOpen, setFullResetOpen] = React.useState(false);

    async function requestReset(kind: 'full' | 'session') {
        await withSavingToast(
            () =>
                reset.mutateAsync({
                    agentId: agent.id,
                    kind,
                    serverId: server.id,
                }),
            {
                successNote:
                    kind === 'full'
                        ? 'The Agent will rebuild its workspace from the starter kit.'
                        : 'The Agent will use fresh context on its next turn.',
            }
        );
    }

    return (
        <>
            <section className="grid gap-4 border-border/50 border-b py-5">
                <BadgeDivider variant="subtle">Session</BadgeDivider>
                <div className="divide-y divide-border/50 border-border/60 border-y">
                    <SessionAction
                        action={
                            <Button
                                disabled={reset.isPending}
                                loading={reset.isPending && !fullResetOpen}
                                onClick={() => requestReset('session').catch(() => undefined)}
                                size="sm"
                                variant="secondary"
                            >
                                Start fresh session
                            </Button>
                        }
                        description="Start the Agent's next turn with fresh context. Workspace, MEMORY.md, and skills persist."
                        title="Start fresh session"
                    />
                    <SessionAction
                        action={
                            <Button
                                disabled={reset.isPending}
                                onClick={() => setFullResetOpen(true)}
                                size="sm"
                                variant="destructive-outline"
                            >
                                Full reset
                            </Button>
                        }
                        description="Start fresh and restore the Agent's workspace, memory, and skills to the factory starter kit."
                        title="Full reset"
                    />
                </div>
            </section>
            <Dialog onOpenChange={setFullResetOpen} open={fullResetOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Full reset?</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-5">
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            This starts a fresh session and permanently wipes the Agent&apos;s
                            workspace, MEMORY.md, skills, and runtime-local state. Identity, Chat
                            history, model configuration, and connections are kept.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button
                                disabled={reset.isPending}
                                onClick={() => setFullResetOpen(false)}
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                Cancel
                            </Button>
                            <Button
                                loading={reset.isPending}
                                onClick={() =>
                                    requestReset('full')
                                        .then(() => setFullResetOpen(false))
                                        .catch(() => undefined)
                                }
                                size="sm"
                                type="button"
                                variant="destructive"
                            >
                                Full reset
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function SessionAction({
    action,
    description,
    title,
}: {
    action: React.ReactNode;
    description: string;
    title: string;
}) {
    return (
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
                <h3 className="font-medium text-foreground text-sm">{title}</h3>
                <p className="text-meta text-muted-foreground">{description}</p>
            </div>
            <div className="shrink-0">{action}</div>
        </div>
    );
}
