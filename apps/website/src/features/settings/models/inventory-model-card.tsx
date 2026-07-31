import { Card, Chip } from '@heroui/react';
import { ModelProviderLogo } from '../../../components/badges/model-provider-logo.tsx';
import { getModelProviderConfig } from '../../../lib/model-provider-config.ts';
import type { ModelInventoryOutput } from '../../../lib/trpc.tsx';

interface InventoryModelCardProps {
    model: ModelInventoryOutput['providers'][number]['models'][number];
    providerId: string;
}

export function InventoryModelCard({ model, providerId }: InventoryModelCardProps) {
    const providerConfig = getModelProviderConfig(providerId);

    return (
        <Card>
            <Card.Header>
                <Card.Title>{model.displayName}</Card.Title>
                <Card.Description>
                    <span className="font-mono text-xs">{model.ref}</span>
                </Card.Description>
            </Card.Header>
            <Card.Content>
                <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="secondary">
                        <ModelProviderLogo
                            color={providerConfig.color}
                            fallbackIcon={providerConfig.icon}
                            iconClassName="size-3.5"
                            logo={providerConfig.logo}
                        />
                        {providerConfig.displayName}
                    </Chip>
                    {model.contextWindow ? (
                        <Chip size="sm" variant="secondary">
                            {formatContextWindow(model.contextWindow)}
                        </Chip>
                    ) : null}
                    {model.capabilities.map((capability) => (
                        <Chip key={capability} size="sm" variant="soft">
                            {formatModelCapability(capability)}
                        </Chip>
                    ))}
                </div>
            </Card.Content>
        </Card>
    );
}

function formatContextWindow(value: number) {
    if (value >= 1000) {
        const rounded = value / 1000;
        return `${new Intl.NumberFormat(undefined, {
            maximumFractionDigits: value % 1000 === 0 ? 0 : 1,
        }).format(rounded)}K context`;
    }

    return `${value} context`;
}

function formatModelCapability(value: string) {
    const label = value.replaceAll('-', ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
}
