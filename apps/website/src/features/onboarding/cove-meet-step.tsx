import { Alert, Button, Label, ListBox, Select } from '@heroui/react';
import * as React from 'react';
import { ActivationStep } from '../../components/activation/activation-shell.tsx';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { useCreateCove } from '../../hooks/servers/use-create-cove.ts';
import type { ServerDetail } from '../../lib/grotto-server.tsx';
import type { CoveOnboardingView } from './cove-onboarding-model.ts';
import { getCoveRepairMessage } from './cove-onboarding-model.ts';
import { SwitchServerButton } from './cove-step-parts.tsx';

export function CoveMeetStep({
    onboarding,
    onSwitchServer,
    serverId,
    view,
}: {
    onboarding: ServerDetail['onboarding'];
    onSwitchServer: () => void;
    serverId: string;
    view: Extract<CoveOnboardingView, 'apply-failed' | 'applying-cove' | 'meet-cove'>;
}) {
    const computers = useComputers(serverId);
    const createCove = useCreateCove();
    const computer = computers.data?.find((candidate) => candidate.id === onboarding.computerId);
    const runtimes = computer?.reportedInventory?.runtimes ?? [];
    const [chosenRuntimeId, setChosenRuntimeId] = React.useState<string | null>(null);
    const [chosenModelId, setChosenModelId] = React.useState<string | null>(null);
    const runtime =
        runtimes.find((candidate) => candidate.id === (onboarding.runtimeId ?? chosenRuntimeId)) ??
        runtimes[0];
    const model =
        runtime?.models.find(
            (candidate) => candidate.id === (onboarding.modelId ?? chosenModelId)
        ) ?? runtime?.models[0];
    const applying = view === 'applying-cove';
    const canSubmit = Boolean(computer && runtime && model) && !applying;
    const submit = () => {
        if (!(computer && runtime && model)) {
            return;
        }
        createCove.mutate({
            computerId: computer.id,
            modelId: model.id,
            runtimeId: runtime.id,
            serverId,
        });
    };

    return (
        <ActivationStep
            footer={
                <>
                    <SwitchServerButton onPress={onSwitchServer} />
                    {applying ? null : (
                        <Button
                            isDisabled={!canSubmit}
                            isPending={createCove.isPending}
                            onPress={submit}
                        >
                            {view === 'apply-failed' ? 'Try again' : 'Create Cove'}
                        </Button>
                    )}
                </>
            }
            title="Meet Cove"
        >
            <div className="grid gap-6">
                {applying ? (
                    <div className="grid gap-6 text-center">
                        <CoveIntroduction />
                        <output aria-live="polite" className="text-muted text-sm">
                            Getting Cove ready…
                        </output>
                    </div>
                ) : null}
                {!applying && (onboarding.failure || createCove.error) ? (
                    <Alert role="alert" status="danger">
                        <Alert.Indicator />
                        <Alert.Content>
                            <Alert.Title>Cove needs another try</Alert.Title>
                            <Alert.Description>
                                {getCoveRepairMessage(onboarding.failure)}
                            </Alert.Description>
                        </Alert.Content>
                    </Alert>
                ) : null}
                {applying ? null : (
                    <div className="grid gap-6">
                        <CoveIntroduction />
                        <div className="grid gap-4">
                            <Select
                                fullWidth
                                isDisabled={view !== 'meet-cove'}
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
                                isDisabled={view !== 'meet-cove'}
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
                                Both come from what the Computer reported. You can change them
                                later.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </ActivationStep>
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
