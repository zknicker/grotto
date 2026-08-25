import type { McpPreset } from '@grotto/api';
import { Button, Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import { Fragment } from 'react';
import { useConnectionPresetAdd } from '../../../hooks/servers/use-connection-preset-add.ts';

const presets: Array<{ description: string; id: McpPreset; name: string }> = [
    {
        description: 'Read and schedule events on your Google calendars.',
        id: 'google-calendar',
        name: 'Google Calendar',
    },
    {
        description: 'Query the MerchBase product catalog, designs, and sales.',
        id: 'merchbase',
        name: 'MerchBase',
    },
];

export function ConnectionPresetSection({ serverId }: { serverId: string }) {
    const addPreset = useConnectionPresetAdd(serverId);

    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>Recommended</ItemCardGroup.Title>
            </ItemCardGroup.Header>
            <ItemCardGroup className="overflow-hidden">
                {presets.map((preset, index) => (
                    <Fragment key={preset.id}>
                        {index > 0 ? <Separator /> : null}
                        <ItemCard>
                            <ItemCard.Content>
                                <ItemCard.Title>{preset.name}</ItemCard.Title>
                                <ItemCard.Description>{preset.description}</ItemCard.Description>
                            </ItemCard.Content>
                            <ItemCard.Action>
                                <Button
                                    isPending={
                                        addPreset.isPending &&
                                        addPreset.variables?.preset === preset.id
                                    }
                                    onPress={() =>
                                        addPreset.mutate({
                                            name: preset.name,
                                            preset: preset.id,
                                            serverId,
                                        })
                                    }
                                    size="sm"
                                    variant="secondary"
                                >
                                    Add
                                </Button>
                            </ItemCard.Action>
                        </ItemCard>
                    </Fragment>
                ))}
            </ItemCardGroup>
        </ItemCardGroup>
    );
}
