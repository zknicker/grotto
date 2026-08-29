import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import type { GrottoUpdateView } from './grotto-update-model.ts';

export function GrottoVersionSummary({ view }: { view: GrottoUpdateView }) {
    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>Version</ItemCardGroup.Title>
            </ItemCardGroup.Header>
            <ItemCardGroup>
                <ItemCard>
                    <ItemCard.Content>
                        <ItemCard.Title>Grotto {view.version}</ItemCard.Title>
                        <ItemCard.Description>
                            Component updates are managed from the sidebar.
                        </ItemCard.Description>
                    </ItemCard.Content>
                </ItemCard>
            </ItemCardGroup>
        </ItemCardGroup>
    );
}
