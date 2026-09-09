import type { Agent } from '@grotto/api';
import { Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import * as React from 'react';

/**
 * The Agent's identity as settled facts. Editing lives on the profile header,
 * where the name and the photo already are, so this card states the record —
 * including the created date, which is a Setup fact rather than an identity one.
 *
 * A factory Agent (Cove) reads the same, with the reason its identity is fixed
 * stated here rather than left as a missing button.
 */
export function AgentProfileCard({ agent }: { agent: Agent }) {
    const rows = [
        { label: 'Name', value: agent.displayName },
        { label: 'Handle', value: `@${agent.handle}` },
        { label: 'Description', value: agent.description || 'No description yet.' },
        { label: 'Created', value: formatCreatedAt(agent.createdAt) },
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

function formatCreatedAt(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
