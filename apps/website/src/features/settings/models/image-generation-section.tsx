import { Description, Label, ListBox, Select } from '@heroui/react';
import { useModelInventory } from '../../../hooks/models/use-model-inventory.ts';
import { queryPolicy } from '../../../lib/query-policy.ts';
import { trpc } from '../../../lib/trpc.tsx';
import { SettingsGroup, SettingsRow, SettingsSection } from '../layout/settings-page.tsx';

/**
 * Image generation runs as a direct capability call, so only models tagged with
 * the imageGeneration capability are offered. "Off" clears the selection.
 */
const offValue = 'off';

export function ImageGenerationSection() {
    const utils = trpc.useUtils();
    const selectionsQuery = trpc.model.capabilitySelections.useQuery(
        undefined,
        queryPolicy.agentRuntimeSnapshot
    );
    const saveSelections = trpc.model.saveCapabilitySelections.useMutation({
        async onSuccess() {
            await utils.model.capabilitySelections.invalidate();
        },
    });
    const inventoryQuery = useModelInventory();

    const options = (inventoryQuery.data?.providers ?? [])
        .flatMap((provider) =>
            provider.models
                .filter((model) => model.capability === 'imageGeneration')
                .map((model) => ({
                    label: model.displayName,
                    provider: provider.provider,
                    value: `${provider.provider}/${model.modelId}`,
                }))
        )
        .sort(
            (left, right) =>
                left.label.localeCompare(right.label) || left.provider.localeCompare(right.provider)
        );

    const selection = selectionsQuery.data?.selections.imageGeneration ?? null;
    const value = selection ? `${selection.provider}/${selection.model}` : offValue;
    const hasImageModels = options.length > 0;

    return (
        <SettingsSection title="Image Generation">
            <SettingsGroup>
                <SettingsRow
                    description={
                        <>
                            <span className="block">Model agents use to generate images.</span>
                            {hasImageModels ? null : (
                                <span className="block">
                                    Connect OpenAI in Model access to enable image models.
                                </span>
                            )}
                        </>
                    }
                    error={saveSelections.error?.message ?? null}
                    title="Image Generation"
                    trailingWidth="control"
                >
                    <Select
                        aria-label="Image generation model"
                        fullWidth
                        isDisabled={selectionsQuery.isPending || saveSelections.isPending}
                        onChange={(next) =>
                            saveSelections.mutate({
                                selections: {
                                    imageGeneration:
                                        next && next !== offValue
                                            ? parseModelValue(String(next))
                                            : null,
                                },
                            })
                        }
                        placeholder="Off"
                        value={value}
                        variant="secondary"
                    >
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                <ListBox.Item id={offValue} textValue="Off">
                                    <Label>Off</Label>
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                                {selection && !options.some((option) => option.value === value) ? (
                                    <ListBox.Item id={value} textValue={value}>
                                        <Label>{value}</Label>
                                        <Description>{selection.provider}</Description>
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ) : null}
                                {options.map((option) => (
                                    <ListBox.Item
                                        id={option.value}
                                        key={option.value}
                                        textValue={option.label}
                                    >
                                        <Label>{option.label}</Label>
                                        <Description>{option.provider}</Description>
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                </SettingsRow>
            </SettingsGroup>
        </SettingsSection>
    );
}

function parseModelValue(value: string): { model: string; provider: string } | null {
    const separator = value.indexOf('/');
    if (separator <= 0) {
        return null;
    }
    return {
        model: value.slice(separator + 1),
        provider: value.slice(0, separator),
    };
}
