import type { Agent } from '@grotto/api';
import { Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import * as React from 'react';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';

/**
 * The Agent's identity as settled facts. Editing lives on the profile header,
 * where the name and the photo already are, so this card states the record —
 * including the created date, which is a Setup fact rather than an identity one.
 *
 * A factory Agent (Cove) reads the same, with the reason its identity is fixed
 * stated here rather than left as a missing button.
 */
export function AgentProfileCard({ agent }: { agent: Agent }) {
    const agents = useAgents(agent.serverId);
    const humans = useHumanDirectory(agent.serverId);
    const creator = agentCreatorName(agent, agents.data ?? [], humans.name);
    const rows = [
        { label: 'Name', value: agent.displayName },
        { label: 'Handle', value: `@${agent.handle}` },
        { label: 'Description', value: agent.description || 'No description yet.' },
        { label: 'Created', value: formatCreatedAt(agent.createdAt, creator) },
    ];

    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>Profile</ItemCardGroup.Title>
                <ItemCardGroup.Description>
                    {agent.factoryKind === 'ordinary'
                        ? 'Edit the name, description, and photo from the profile header.'
                        : `${agent.displayName} is a product-owned Agent, so the Server keeps this identity fixed.`}
                </ItemCardGroup.Description>
            </ItemCardGroup.Header>
            <ItemCardGroup className="overflow-hidden">
                {rows.map((row, index) => (
                    <React.Fragment key={row.label}>
                        {index > 0 ? <Separator /> : null}
                        <ItemCard>
                            <ItemCard.Content>
                                <ItemCard.Title>{row.label}</ItemCard.Title>
                                <ItemCard.Description>{row.value}</ItemCard.Description>
                            </ItemCard.Content>
                        </ItemCard>
                    </React.Fragment>
                ))}
            </ItemCardGroup>
        </ItemCardGroup>
    );
}

/**
 * A creating Agent is named from the directory; a creating human from members.
 *
 * An Agent another Agent created has no other place that says so, and who added
 * a teammate is the fact a reader needs before trusting one they did not add
 * themselves. The creator is named, never linked: this row is provenance, and
 * the profile it would open is one the reader can already reach by name.
 */
export function agentCreatorName(
    agent: Pick<Agent, 'createdByAgentId' | 'createdByUserId'>,
    agents: readonly Agent[],
    humanName: (userId: string) => string
): string | null {
    if (agent.createdByAgentId) {
        return (
            agents.find((candidate) => candidate.id === agent.createdByAgentId)?.displayName ?? null
        );
    }
    return agent.createdByUserId ? humanName(agent.createdByUserId) : null;
}

function formatCreatedAt(value: Date | string, creator: string | null) {
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(value)
    );
    return creator ? `${date} by ${creator}` : date;
}
