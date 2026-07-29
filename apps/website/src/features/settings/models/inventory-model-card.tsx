import { ModelProviderBadge } from '../../../components/badges/model-provider-badge.tsx';
import { Badge } from '../../../components/ui/badge.tsx';
import { Card } from '../../../components/ui/card.tsx';
import { getModelProviderConfig } from '../../../lib/model-provider-config.ts';
import type { ModelInventoryOutput } from '../../../lib/trpc.tsx';

interface InventoryModelCardProps {
    model: ModelInventoryOutput['providers'][number]['models'][number];
    providerId: string;
}

export function InventoryModelCard({ model, providerId }: InventoryModelCardProps) {
    const providerConfig = getModelProviderConfig(providerId);

    return (
        <Card className="h-full justify-between p-4 transition-colors hover:border-border-strong">
            <div>
                <div className="min-w-0">
                    <p className="font-medium text-base text-foreground leading-6">
                        {model.displayName}
                    </p>
                    <p className="mt-1 truncate font-medium text-meta text-muted-foreground">
                        {model.ref}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <ModelProviderBadge
                    color={providerConfig.color}
                    icon={providerConfig.icon}
                    label={providerConfig.displayName}
                    logo={providerConfig.logo}
                    size="sm"
                />
                {model.contextWindow ? (
                    <Badge size="sm" variant="secondary">
                        {formatContextWindow(model.contextWindow)}
                    </Badge>
                ) : null}
                {model.capabilities.map((capability) => (
                    <Badge key={capability} size="sm" variant="subtle">
                        {formatModelCapability(capability)}
                    </Badge>
                ))}
            </div>
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
    return value.replaceAll('-', ' ');
}
