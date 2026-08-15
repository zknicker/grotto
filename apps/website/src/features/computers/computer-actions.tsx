import { Button, Separator, Tooltip } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import { CodeBlock } from '@heroui-pro/react/code-block';
import { useState } from 'react';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { ComputerUpdateControls } from './computer-update-controls.tsx';
import {
    ComputerUpdatePreviewMenu,
    type ComputerUpdatePreviewState,
} from './computer-update-preview.tsx';

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
    const [updatePreviewState, setUpdatePreviewState] =
        useState<ComputerUpdatePreviewState>('live');
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
        <section className="grid gap-8 py-5">
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header className="flex items-center justify-between">
                    <ItemCardGroup.Title>Computer Management</ItemCardGroup.Title>
                    {import.meta.env.DEV ? (
                        <ComputerUpdatePreviewMenu
                            onChange={setUpdatePreviewState}
                            value={updatePreviewState}
                        />
                    ) : null}
                </ItemCardGroup.Header>
                <ItemCardGroup className="overflow-hidden">
                    <ComputerUpdateControls
                        computer={computer}
                        previewState={updatePreviewState}
                        serverId={serverId}
                    />
                    <Separator />
                    <ComputerRemovalAction availability={removalAvailability} onRemove={onRemove} />
                </ItemCardGroup>
            </ItemCardGroup>
            <RecoveryCommands serverSlug={serverSlug} />
        </section>
    );
}

export function RecoveryCommands({ serverSlug }: { serverSlug: string }) {
    const commands = [
        '# Check whether each Server attachment is stopped or running',
        'grotto-computer status',
        '',
        '# Check local files and Server credential acceptance',
        'grotto-computer doctor',
        '',
        '# Restart this attachment if it stops responding',
        `grotto-computer restart /${serverSlug}`,
        '',
        '# Restore the previous verified Computer release',
        'grotto-computer upgrade --rollback',
    ].join('\n');

    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>Recovery Commands</ItemCardGroup.Title>
            </ItemCardGroup.Header>
            <CodeBlock>
                <CodeBlock.Header>
                    <span className="text-muted text-xs">Shell</span>
                    <CodeBlock.CopyButton aria-label="Copy recovery commands" code={commands} />
                </CodeBlock.Header>
                <CodeBlock.Code code={commands} language="shellscript" />
            </CodeBlock>
        </ItemCardGroup>
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
        <ItemCard>
            <ItemCard.Content>
                <ItemCard.Title>Remove Computer</ItemCard.Title>
                <ItemCard.Description>
                    Permanently remove this Computer. All Agents must be deleted first.
                </ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
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
            </ItemCard.Action>
        </ItemCard>
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
