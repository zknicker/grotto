import type { Agent } from '@haus/api';
import { AlertDialog, Button, Dropdown, Label, Tooltip } from '@heroui/react';
import { MoreHorizontalIcon, RefreshIcon, StopIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgentRestart } from '../../../hooks/members/use-agent-restart.ts';
import { useAgentState } from '../../../hooks/members/use-agent-state.ts';
import { useAgentStop } from '../../../hooks/members/use-agent-stop.ts';
import type { ServerDetail } from '../../../lib/haus-server.tsx';

/**
 * Session control is an owner/admin capability — the same gate the profile's
 * Session section carries — so a member sees no menu and the peek asks the
 * Server for no delivery state on their behalf.
 */
export function AgentPeekActions({ agent, server }: { agent: Agent; server: ServerDetail }) {
    if (!(server.role === 'owner' || server.role === 'admin')) {
        return null;
    }

    return <AgentPeekSessionMenu agent={agent} serverId={server.id} />;
}

/**
 * The only two things the peek can change: halt the current run, or restart the
 * runtime. Everything else an operator can do to an Agent lives on its profile,
 * so this is one menu rather than a row of buttons. Restart interrupts live
 * work, so it confirms first.
 */
function AgentPeekSessionMenu({ agent, serverId }: { agent: Agent; serverId: string }) {
    const [restartOpen, setRestartOpen] = React.useState(false);
    const state = useAgentState(serverId, agent.id);
    const stop = useAgentStop(serverId, agent.id);
    const restart = useAgentRestart(serverId, agent.id);

    return (
        <>
            <Dropdown>
                <Tooltip>
                    <Button aria-label="Agent actions" isIconOnly size="sm" variant="ghost">
                        <Icon aria-hidden="true" className="size-3.5" icon={MoreHorizontalIcon} />
                    </Button>
                    <Tooltip.Content>Agent actions</Tooltip.Content>
                </Tooltip>
                <Dropdown.Popover placement="bottom end">
                    <Dropdown.Menu
                        onAction={(key) => {
                            if (key === 'stop') {
                                void stop.stop();
                                return;
                            }
                            if (key === 'restart') {
                                setRestartOpen(true);
                            }
                        }}
                    >
                        <Dropdown.Item
                            id="stop"
                            isDisabled={!state.data?.running || stop.isPending}
                            textValue="Stop"
                        >
                            <Icon icon={StopIcon} size={16} />
                            <Label>Stop</Label>
                        </Dropdown.Item>
                        <Dropdown.Item
                            id="restart"
                            isDisabled={restart.isPending}
                            textValue="Restart"
                        >
                            <Icon icon={RefreshIcon} size={16} />
                            <Label>Restart</Label>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>
            <AlertDialog isOpen={restartOpen} onOpenChange={setRestartOpen}>
                <AlertDialog.Backdrop isDismissable>
                    <AlertDialog.Container size="sm">
                        <AlertDialog.Dialog>
                            <AlertDialog.Header>
                                <AlertDialog.Icon status="warning" />
                                <AlertDialog.Heading>
                                    Restart {agent.displayName}?
                                </AlertDialog.Heading>
                            </AlertDialog.Header>
                            <AlertDialog.Body>
                                This restarts the Agent's runtime and interrupts whatever it is
                                doing. Context, workspace, and skills persist.
                            </AlertDialog.Body>
                            <AlertDialog.Footer>
                                <Button
                                    isDisabled={restart.isPending}
                                    slot="close"
                                    type="button"
                                    variant="secondary"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    isPending={restart.isPending}
                                    onPress={() => {
                                        void restart.restart().then(() => setRestartOpen(false));
                                    }}
                                    type="button"
                                    variant="primary"
                                >
                                    Restart
                                </Button>
                            </AlertDialog.Footer>
                        </AlertDialog.Dialog>
                    </AlertDialog.Container>
                </AlertDialog.Backdrop>
            </AlertDialog>
        </>
    );
}
