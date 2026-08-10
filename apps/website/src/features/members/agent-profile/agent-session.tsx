import { AlertDialog, Button, Separator } from '@heroui/react';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { useAgentReset } from '../../../hooks/members/use-agent-reset.ts';
import { useAgentRestart } from '../../../hooks/members/use-agent-restart.ts';
import { useAgentState } from '../../../hooks/members/use-agent-state.ts';
import { useAgentStop } from '../../../hooks/members/use-agent-stop.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';
import { fullResetCopy } from './agent-session-model.ts';

export function AgentSession({ agent, server }: { agent: HostedAgent; server: ServerDetail }) {
    const reset = useAgentReset(server.id, agent.id);
    const stop = useAgentStop(server.id, agent.id);
    const restart = useAgentRestart(server.id, agent.id);
    const state = useAgentState(server.id, agent.id);
    const [fullResetOpen, setFullResetOpen] = React.useState(false);
    const resetCopy = fullResetCopy(agent.factoryKind);

    // Ordered by how much they disturb the Agent: halt the current run, restart
    // the process, drop its context, then rebuild it from the ordinary factory state.
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
                        onPress={stop.stop}
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
                        onPress={restart.restart}
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
                        onPress={() => reset.reset('session').catch(() => undefined)}
                        size="sm"
                        variant="secondary"
                    >
                        Start Fresh Session
                    </Button>
                </SettingsRow>
                <Separator />
                <SettingsRow
                    description={resetCopy.description}
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
                <AlertDialog.Backdrop isDismissable>
                    <AlertDialog.Container size="sm">
                        <AlertDialog.Dialog>
                            <AlertDialog.Header>
                                <AlertDialog.Icon status="danger" />
                                <AlertDialog.Heading>Full Reset?</AlertDialog.Heading>
                            </AlertDialog.Header>
                            <AlertDialog.Body>{resetCopy.confirmation}</AlertDialog.Body>
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
                                        reset
                                            .reset('full')
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
