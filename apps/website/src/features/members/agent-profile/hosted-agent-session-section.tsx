import { AlertDialog, Button, Separator } from '@heroui/react';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';

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
        <SettingsSection title="Session">
            <SettingsGroup>
                <SettingsRow
                    description="Start the Agent's next turn with fresh context. Workspace, MEMORY.md, and skills persist."
                    title="Start Fresh Session"
                    trailingWidth="intrinsic"
                >
                    <Button
                        isDisabled={reset.isPending}
                        isPending={reset.isPending && !fullResetOpen}
                        onPress={() => requestReset('session').catch(() => undefined)}
                        size="sm"
                        variant="secondary"
                    >
                        Start Fresh Session
                    </Button>
                </SettingsRow>
                <Separator />
                <SettingsRow
                    description="Start fresh and restore the Agent's workspace, memory, and skills to the factory starter kit."
                    title="Full Reset"
                    trailingWidth="intrinsic"
                >
                    <Button
                        isDisabled={reset.isPending}
                        onPress={() => setFullResetOpen(true)}
                        size="sm"
                        variant="danger-soft"
                    >
                        Full Reset
                    </Button>
                </SettingsRow>
            </SettingsGroup>
            <AlertDialog isOpen={fullResetOpen} onOpenChange={setFullResetOpen}>
                <AlertDialog.Backdrop>
                    <AlertDialog.Container size="sm">
                        <AlertDialog.Dialog>
                            <AlertDialog.Header>
                                <AlertDialog.Icon status="danger" />
                                <AlertDialog.Heading>Full Reset?</AlertDialog.Heading>
                            </AlertDialog.Header>
                            <AlertDialog.Body>
                                This starts a fresh session and permanently wipes the Agent&apos;s
                                workspace, MEMORY.md, skills, and runtime-local state. Identity,
                                Chat history, model configuration, and connections are kept.
                            </AlertDialog.Body>
                            <AlertDialog.Footer>
                                <Button
                                    isDisabled={reset.isPending}
                                    slot="close"
                                    type="button"
                                    variant="secondary"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    isPending={reset.isPending}
                                    onPress={() =>
                                        requestReset('full')
                                            .then(() => setFullResetOpen(false))
                                            .catch(() => undefined)
                                    }
                                    type="button"
                                    variant="danger"
                                >
                                    Full Reset
                                </Button>
                            </AlertDialog.Footer>
                        </AlertDialog.Dialog>
                    </AlertDialog.Container>
                </AlertDialog.Backdrop>
            </AlertDialog>
        </SettingsSection>
    );
}
