import { Button, Chip, Dropdown, Label, toast } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import { MoreHorizontalIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import {
    useCloudAgentCapability,
    useCloudAgentConnect,
    useCloudAgentDisconnect,
} from '../../hooks/servers/use-cloud-agent-capability.ts';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import {
    type CloudAgentCapabilityView,
    cloudAgentCapabilityView,
    reportedCloudAgentCapability,
} from './cloud-agent-capability-model.ts';

/**
 * Cloud Agent provider access on this Computer — a capability of the machine,
 * beside its runtimes, not a runtime itself. The two stay separate because
 * Cursor's CLI and its SDK use different credential stores even for one
 * account. Connecting opens Cursor's own browser sign-in on the Computer.
 */
export function CloudAgentCapabilityCard({
    computerId,
    serverId,
}: {
    computerId: string;
    serverId: string;
}) {
    const target = { computerId, provider: 'cursor' as const, serverId };
    const computers = useComputers(serverId);
    const computer = computers.data?.find((candidate) => candidate.id === computerId);
    const isOffline = computer ? computer.health === 'offline' : true;
    const capability = useCloudAgentCapability(target, Boolean(computer) && !isOffline);
    const connect = useCloudAgentConnect(target);
    const disconnect = useCloudAgentDisconnect(target);

    const view = cloudAgentCapabilityView({
        isConnecting: connect.isPending,
        isOffline,
        state: capability.data ?? reportedCloudAgentCapability(computer?.reportedInventory ?? null),
    });

    const handleConnect = async () => {
        try {
            const state = await connect.mutateAsync(target);
            toast.success('Cursor connected', {
                description: state.accountEmail
                    ? `This Computer signs in as ${state.accountEmail}.`
                    : 'This Computer can now start Cloud Agents.',
            });
        } catch (error) {
            toast.danger('Couldn’t connect Cursor', { description: errorMessage(error) });
        }
    };

    const handleDisconnect = async () => {
        try {
            await disconnect.mutateAsync(target);
            toast.success('Cursor disconnected', {
                description: 'The key stays revocable from Cursor’s dashboard.',
            });
        } catch (error) {
            toast.danger('Couldn’t disconnect Cursor', { description: errorMessage(error) });
        }
    };

    return (
        <section>
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header>
                    <ItemCardGroup.Title>Cloud Agents</ItemCardGroup.Title>
                </ItemCardGroup.Header>
                <ItemCardGroup className="overflow-hidden">
                    <CloudAgentCapabilityRow
                        isDisconnecting={disconnect.isPending}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                        view={view}
                    />
                </ItemCardGroup>
            </ItemCardGroup>
        </section>
    );
}

export function CloudAgentCapabilityRow({
    isDisconnecting,
    onConnect,
    onDisconnect,
    view,
}: {
    isDisconnecting: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
    view: CloudAgentCapabilityView;
}) {
    return (
        <ItemCard>
            <ItemCard.Content>
                <ItemCard.Title>
                    Cursor Cloud Agents
                    <Chip
                        className="ms-2 align-middle"
                        color={statusColor(view.status)}
                        size="sm"
                        variant="soft"
                    >
                        {view.statusLabel}
                    </Chip>
                </ItemCard.Title>
                <ItemCard.Description>{view.description}</ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
                <div className="flex items-center gap-2">
                    {view.status === 'ready' ? null : (
                        <Button
                            isDisabled={!view.canConnect}
                            isPending={view.status === 'connecting'}
                            onPress={onConnect}
                            size="sm"
                            variant="secondary"
                        >
                            Connect
                        </Button>
                    )}
                    {view.canDisconnect ? (
                        <Dropdown>
                            <Button
                                aria-label="Cursor Cloud Agents actions"
                                size="sm"
                                variant="ghost"
                            >
                                <Icon aria-hidden="true" icon={MoreHorizontalIcon} />
                            </Button>
                            <Dropdown.Popover placement="bottom end">
                                <Dropdown.Menu>
                                    <Dropdown.Item
                                        id="disconnect"
                                        isDisabled={isDisconnecting}
                                        onAction={onDisconnect}
                                        textValue="Disconnect Cursor"
                                        variant="danger"
                                    >
                                        <Label>Disconnect Cursor</Label>
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown>
                    ) : null}
                </div>
            </ItemCard.Action>
        </ItemCard>
    );
}

function statusColor(status: CloudAgentCapabilityView['status']) {
    switch (status) {
        case 'ready':
            return 'success' as const;
        case 'connecting':
            return 'accent' as const;
        case 'not-connected':
            return 'warning' as const;
        case 'unavailable':
            return 'default' as const;
    }
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Try again.';
}
