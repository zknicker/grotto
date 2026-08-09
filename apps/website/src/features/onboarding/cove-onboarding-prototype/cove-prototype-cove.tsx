import { Alert, Button, FieldError, Label, ListBox, Select } from '@heroui/react';
import { ActivationStep } from '../../../components/activation/activation-shell.tsx';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { SwitchServerButton } from '../cove-step-parts.tsx';
import {
    type CovePrototypeState,
    covePrototypeRuntimes,
    getCoveConfigErrors,
} from './cove-prototype-model.ts';

/**
 * Step 2. Cove's identity is fixed by ADR 0021, so the only real choices are
 * the runtime and model it runs on.
 */
export function MeetCoveStep({
    modelId,
    onModelChange,
    onRuntimeChange,
    onStateChange,
    runtimeId,
    state,
}: {
    modelId: string;
    onModelChange: (modelId: string) => void;
    onRuntimeChange: (runtimeId: string) => void;
    onStateChange: (state: CovePrototypeState) => void;
    runtimeId: string;
    state: CovePrototypeState;
}) {
    const errors = getCoveConfigErrors({ modelId, runtimeId });
    const isValid = Object.keys(errors).length === 0;
    const showValidation = state === 'validation-error';
    const isCreating = state === 'creating-cove';
    const isRetrying = state === 'creation-failed';
    const selectedRuntime = covePrototypeRuntimes.find((runtime) => runtime.id === runtimeId);

    return (
        <ActivationStep
            footer={
                <>
                    <SwitchServerButton onPress={() => onStateChange('choose-server')} />
                    <Button
                        isDisabled={!isValid}
                        isPending={isCreating}
                        onPress={() => onStateChange(isRetrying ? 'creating-cove' : 'handoff')}
                    >
                        {getSubmitLabel(state)}
                    </Button>
                </>
            }
            title="Meet Cove"
        >
            <div className="grid gap-6">
                {state === 'creation-failed' ? (
                    <Alert role="alert" status="danger">
                        <Alert.Indicator />
                        <Alert.Content>
                            <Alert.Title>Cove could not be created</Alert.Title>
                            <Alert.Description>
                                The name is reserved once. Retrying repairs this step instead of
                                creating a second Cove.
                            </Alert.Description>
                        </Alert.Content>
                    </Alert>
                ) : null}
                <div className="grid gap-6">
                    <CoveIntroduction />
                    <div className="grid gap-4">
                        <Select
                            disabledKeys={covePrototypeRuntimes
                                .filter((runtime) => runtime.status === 'undetected')
                                .map((runtime) => runtime.id)}
                            fullWidth
                            isInvalid={showValidation && Boolean(errors.runtime)}
                            isRequired
                            onChange={(value) => {
                                const nextRuntimeId = value ? String(value) : '';
                                const nextRuntime = covePrototypeRuntimes.find(
                                    (runtime) => runtime.id === nextRuntimeId
                                );
                                onRuntimeChange(nextRuntimeId);
                                onModelChange(nextRuntime?.models[0]?.id ?? '');
                            }}
                            placeholder="Select…"
                            value={runtimeId}
                            variant="secondary"
                        >
                            <Label>Runtime</Label>
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {covePrototypeRuntimes.map((runtime) => (
                                        <ListBox.Item
                                            id={runtime.id}
                                            key={runtime.id}
                                            textValue={runtime.label}
                                        >
                                            <Label>{runtime.label}</Label>
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                            {showValidation && errors.runtime ? (
                                <FieldError>{errors.runtime}</FieldError>
                            ) : null}
                        </Select>
                        <Select
                            fullWidth
                            isDisabled={!selectedRuntime || selectedRuntime.models.length === 0}
                            isInvalid={showValidation && Boolean(errors.model)}
                            isRequired
                            onChange={(value) => onModelChange(value ? String(value) : '')}
                            placeholder="Select…"
                            value={modelId}
                            variant="secondary"
                        >
                            <Label>Model</Label>
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {(selectedRuntime?.models ?? []).map((model) => (
                                        <ListBox.Item
                                            id={model.id}
                                            key={model.id}
                                            textValue={model.label}
                                        >
                                            <Label>{model.label}</Label>
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                            {showValidation && errors.model ? (
                                <FieldError>{errors.model}</FieldError>
                            ) : null}
                        </Select>
                        <p className="text-base text-muted sm:text-sm">
                            Both come from what the Computer reported. You can change them later.
                        </p>
                    </div>
                </div>
            </div>
        </ActivationStep>
    );
}

/** The submit button is the only place this step reports what it is doing. */
function getSubmitLabel(state: CovePrototypeState): string {
    if (state === 'creating-cove') {
        return 'Creating…';
    }
    if (state === 'creation-failed') {
        return 'Try again';
    }
    return 'Create Cove';
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
