import { Alert, Button, Label, ListBox, Select } from '@heroui/react';
import * as React from 'react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import type { ServerDetail } from '../../lib/grotto-server.tsx';
import {
    StepSection,
    SwitchServerButton,
} from './cove-onboarding-prototype/cove-prototype-shell.tsx';

export function CoveMeetStep({
    onboarding,
    onSwitchServer,
    serverId,
}: {
    onboarding: ServerDetail['onboarding'];
    onSwitchServer: () => void;
    serverId: string;
}) {
    const computers = useComputers(serverId);
    const computer = computers.data?.find((candidate) => candidate.id === onboarding.computerId);
    const runtimes = computer?.reportedInventory?.runtimes ?? [];
    const [chosenRuntimeId, setChosenRuntimeId] = React.useState<string | null>(null);
    const [chosenModelId, setChosenModelId] = React.useState<string | null>(null);
    const runtime = runtimes.find((candidate) => candidate.id === chosenRuntimeId) ?? runtimes[0];
    const model =
        runtime?.models.find((candidate) => candidate.id === chosenModelId) ?? runtime?.models[0];

    return (
        <StepSection
            footer={
                <>
                    <SwitchServerButton onPress={onSwitchServer} />
                    <Button isDisabled>Create Cove</Button>
                </>
            }
            title="Meet Cove"
        >
            <div className="grid gap-6">
                {onboarding.failure ? (
                    <Alert role="alert" status="danger">
                        <Alert.Indicator />
                        <Alert.Content>
                            <Alert.Title>Computer needs attention</Alert.Title>
                            <Alert.Description>{onboarding.failure.detail}</Alert.Description>
                        </Alert.Content>
                    </Alert>
                ) : null}
                <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
                    <CoveIntroduction />
                    <div className="grid gap-4">
                        <Select
                            fullWidth
                            onChange={(value) => {
                                const next = value ? String(value) : null;
                                setChosenRuntimeId(next);
                                setChosenModelId(null);
                            }}
                            value={runtime?.id ?? ''}
                            variant="secondary"
                        >
                            <Label>Runtime</Label>
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {runtimes.map((candidate) => (
                                        <ListBox.Item
                                            id={candidate.id}
                                            key={candidate.id}
                                            textValue={candidate.label}
                                        >
                                            <Label>{candidate.label}</Label>
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                        <Select
                            fullWidth
                            onChange={(value) => setChosenModelId(value ? String(value) : null)}
                            value={model?.id ?? ''}
                            variant="secondary"
                        >
                            <Label>Model</Label>
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {(runtime?.models ?? []).map((candidate) => (
                                        <ListBox.Item
                                            id={candidate.id}
                                            key={candidate.id}
                                            textValue={candidate.label}
                                        >
                                            <Label>{candidate.label}</Label>
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                        <p className="text-base text-muted sm:text-sm">
                            Both come from what the Computer reported. You can change them later.
                        </p>
                    </div>
                </div>
            </div>
        </StepSection>
    );
}

function CoveIntroduction() {
    return (
        <div className="flex flex-col items-center gap-3 text-center">
            <EntityAvatar name="Cove" size={88} src="/prototypes/cove-avatar.png" />
            <div className="grid gap-1">
                <p className="font-semibold text-lg">Cove</p>
                <p className="text-base text-muted sm:text-sm">
                    Your first Agent. Cove sets up the Server, brings your team in, and gets you
                    working for real.
                </p>
                <p className="text-muted text-xs">@cove · Onboarding Assistant · Admin</p>
            </div>
        </div>
    );
}
