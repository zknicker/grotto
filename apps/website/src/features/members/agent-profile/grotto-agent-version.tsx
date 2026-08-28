import type { GrottoAgentState } from '@grotto/api';
import { Chip, Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import { SettingsFact } from '../../settings/layout/settings-text.tsx';
import { grottoAgentVersionView } from './grotto-agent-version-model.ts';

export function GrottoAgentVersion({ state }: { state: GrottoAgentState }) {
    const view = grottoAgentVersionView(state);

    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>Grotto Agent</ItemCardGroup.Title>
                <ItemCardGroup.Description>
                    Managed instructions, actions, recipes, and factory guidance.
                </ItemCardGroup.Description>
            </ItemCardGroup.Header>
            <ItemCardGroup className="overflow-hidden">
                <ItemCard>
                    <ItemCard.Content>
                        <ItemCard.Title>Version</ItemCard.Title>
                    </ItemCard.Content>
                    <ItemCard.Action>
                        <Chip color={view.color} size="sm" variant="soft">
                            <Chip.Label>
                                {view.version} · {view.detail}
                            </Chip.Label>
                        </Chip>
                    </ItemCard.Action>
                </ItemCard>
                <Separator />
                <ItemCard>
                    <ItemCard.Content>
                        <ItemCard.Title>Applied</ItemCard.Title>
                    </ItemCard.Content>
                    <ItemCard.Action>
                        <SettingsFact>
                            {state.appliedAt ? formatAppliedAt(state.appliedAt) : 'Not yet'}
                        </SettingsFact>
                    </ItemCard.Action>
                </ItemCard>
            </ItemCardGroup>
        </ItemCardGroup>
    );
}

function formatAppliedAt(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
