import { Button, Disclosure, Tooltip } from '@heroui/react';
import { CodeSnippet } from '../../components/code-snippet.tsx';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { ComputerUpdateControls } from './computer-update-controls.tsx';

type ComputerRemovalAvailability =
    | { status: 'checking' }
    | { status: 'error' }
    | { agentNames: string[]; status: 'blocked' }
    | { status: 'ready' };

export function ComputerActions({
    computerId,
    onRemove,
    serverId,
    serverSlug,
}: {
    computerId: string;
    onRemove: () => void;
    serverId: string;
    serverSlug: string;
}) {
    const agents = useAgents(serverId);
    const computers = useComputers(serverId);
    const computer = computers.data?.find((candidate) => candidate.id === computerId);

    if (!computer) {
        return null;
    }

    const assignedAgents = (agents.data ?? []).filter((agent) => agent.computerId === computerId);
    let removalAvailability: ComputerRemovalAvailability;
    if (agents.data === undefined) {
        removalAvailability = agents.error ? { status: 'error' } : { status: 'checking' };
    } else if (assignedAgents.length > 0) {
        removalAvailability = {
            agentNames: assignedAgents.map((agent) => agent.displayName),
            status: 'blocked',
        };
    } else {
        removalAvailability = { status: 'ready' };
    }

    return (
        <section className="grid gap-4 py-5">
            <h2 className="font-medium text-muted text-sm">Actions</h2>
            <div className="grid gap-5">
                <ComputerUpdateControls computer={computer} serverId={serverId} />
                <Disclosure>
                    <Disclosure.Heading>
                        <Button slot="trigger" variant="ghost">
                            Recovery Commands
                            <Disclosure.Indicator />
                        </Button>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                        <Disclosure.Body>
                            <div className="grid gap-3">
                                <p className="text-muted text-sm">
                                    If the App and this Computer disagree, check the machine
                                    directly.
                                </p>
                                <CodeSnippet
                                    lines={[
                                        'grotto-computer status',
                                        'grotto-computer doctor',
                                        `grotto-computer restart /${serverSlug}`,
                                        'grotto-computer upgrade --rollback',
                                    ]}
                                />
                            </div>
                        </Disclosure.Body>
                    </Disclosure.Content>
                </Disclosure>
                <ComputerRemovalAction availability={removalAvailability} onRemove={onRemove} />
            </div>
        </section>
    );
}

export function ComputerRemovalAction({
    availability,
    onRemove,
}: {
    availability: ComputerRemovalAvailability;
    onRemove: () => void;
}) {
    const isBlocked = availability.status !== 'ready';
    const description = computerRemovalDescription(availability);
    const button = (
        <Button isDisabled={isBlocked} onPress={onRemove} size="sm" variant="danger-soft">
            Remove Computer
        </Button>
    );

    return (
        <div className="flex flex-col gap-3 border-separator border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h3 className="font-medium text-foreground text-sm">Remove Computer</h3>
                <p className="text-muted text-sm">{description}</p>
            </div>
            {isBlocked ? (
                <Tooltip delay={0}>
                    <Tooltip.Trigger aria-label={description}>
                        <span className="inline-flex cursor-not-allowed">{button}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Content showArrow>
                        <Tooltip.Arrow />
                        <p className="max-w-xs">{description}</p>
                    </Tooltip.Content>
                </Tooltip>
            ) : (
                button
            )}
        </div>
    );
}

function computerRemovalDescription(availability: ComputerRemovalAvailability) {
    if (availability.status === 'ready') {
        return 'This immediately revokes this Computer’s credential.';
    }
    if (availability.status === 'checking') {
        return 'Checking for assigned Agents…';
    }
    if (availability.status === 'error') {
        return 'Assigned Agents could not be verified. Try again.';
    }
    if (availability.agentNames.length === 1) {
        return `Delete ${availability.agentNames[0]} before removing this Computer.`;
    }
    return `Delete all ${availability.agentNames.length} assigned Agents before removing this Computer.`;
}
