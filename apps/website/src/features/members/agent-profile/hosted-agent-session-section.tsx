import { AlertDialog, Button, Separator } from '@heroui/react';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { withSaveErrorToast, withSavingToast } from '../../../lib/saving-toast.ts';
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

    function invalidate() {
        return Promise.all([
            utils.agent.deliveryState.invalidate({ agentId: agent.id, serverId: server.id }),
            utils.agent.list.invalidate({ serverId: server.id }),
        ]);
    }

    const reset = grottoTrpc.agent.reset.useMutation({ onSuccess: invalidate });
    const stop = grottoTrpc.agent.stop.useMutation({ onSuccess: invalidate });
    const restart = grottoTrpc.agent.restart.useMutation({ onSuccess: invalidate });
    const state = grottoTrpc.agent.deliveryState.useQuery({
        agentId: agent.id,
        serverId: server.id,
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

    // Ordered by how much they disturb the Agent: halt the current run, restart
    // the process, drop its context, then rebuild it from the starter kit.
    return (
        <SettingsSection title="Session">
            <SettingsGroup>
                <SettingsRow
                    description="Halt whatever the Agent is doing right now."
                    title="Stop"
                    trailingWidth="intrinsic"
                >
                    <Button
                        isDisabled={!state.data?.running || stop.isPending}
                        isPending={stop.isPending}
                        onPress={() =>
                            withSaveErrorToast(() =>
                                stop.mutateAsync({ agentId: agent.id, serverId: server.id })
                            ).catch(() => undefined)
                        }
                        size="sm"
                        variant="secondary"
                    >
                        Stop
                    </Button>
                </SettingsRow>
                <Separator />
                <SettingsRow
                    description="Restart the Agent's runtime. Context, workspace, and skills persist."
                    title="Restart"
                    trailingWidth="intrinsic"
                >
                    <Button
                        isDisabled={restart.isPending}
                        isPending={restart.isPending}
                        onPress={() =>
                            withSaveErrorToast(() =>
                                restart.mutateAsync({ agentId: agent.id, serverId: server.id })
                            ).catch(() => undefined)
                        }
                        size="sm"
                        variant="secondary"
                    >
                        Restart
                    </Button>
                </SettingsRow>
                <Separator />
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
