import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { useModelInventory } from '../../../hooks/models/use-model-inventory.ts';
import type { ModelInventoryOutput } from '../../../lib/trpc.tsx';
import { InventoryModelCard } from './inventory-model-card.tsx';

type ModelCapability =
    ModelInventoryOutput['providers'][number]['models'][number]['capabilities'][number];

const capabilityLabels = [
    { label: 'General', value: 'general' },
    { label: 'Embedding', value: 'embedding' },
    { label: 'Vision', value: 'vision' },
    { label: 'Audio transcription', value: 'audio-transcription' },
] as const satisfies ReadonlyArray<{ label: string; value: ModelCapability }>;

export function ModelInventorySection() {
    const inventoryQuery = useModelInventory();
    const [search, setSearch] = React.useState('');

    if (inventoryQuery.isLoading) {
        return <ModelInventoryLoadingState />;
    }

    if (inventoryQuery.error) {
        return (
            <div className="pb-4">
                <Alert variant="error">
                    <Icon icon={AlertCircleIcon} />
                    <AlertDescription>{inventoryQuery.error.message}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!inventoryQuery.data) {
        return null;
    }

    const flatModels = inventoryQuery.data.providers.flatMap((provider) =>
        provider.models
            .map((model) => ({
                ...model,
                providerId: provider.provider,
            }))
            .filter((model) => matchesSearch(model, search))
    );

    return (
        <div className="flex flex-col gap-4 pb-4">
            <SearchInput
                aria-label="Search models"
                className="w-full"
                name="model-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter models..."
                size="lg"
                value={search}
            />

            {flatModels.length > 0 ? (
                <ul className="grid list-none gap-3 p-0 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {flatModels.map((model) => (
                        <li key={model.ref}>
                            <InventoryModelCard model={model} providerId={model.providerId} />
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="rounded-xl border border-border-subtle border-dashed bg-legacy-muted px-4 py-6 text-center text-muted-foreground text-sm">
                    No models match this search.
                </div>
            )}
        </div>
    );
}

function matchesSearch(
    model: ModelInventoryOutput['providers'][number]['models'][number],
    search: string
) {
    const normalizedSearch = search.trim().toLowerCase();

    if (normalizedSearch.length === 0) {
        return true;
    }

    return [
        model.displayName,
        model.ref,
        model.description ?? '',
        ...model.capabilities.map(formatModelCapability),
    ].some((value) => value.toLowerCase().includes(normalizedSearch));
}

function formatModelCapability(capability: ModelCapability) {
    return (
        capabilityLabels.find((option) => option.value === capability)?.label ??
        capability.replaceAll('-', ' ')
    );
}

function ModelInventoryLoadingState() {
    return (
        <div className="flex flex-col gap-4 pb-4">
            <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-10 w-72 rounded-xl" />
                <Skeleton className="h-9 w-28 rounded-md" />
            </div>
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
        </div>
    );
}
