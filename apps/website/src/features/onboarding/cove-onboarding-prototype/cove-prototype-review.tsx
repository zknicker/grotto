import { Description, Label, ListBox, Select } from '@heroui/react';
import {
    type CovePrototypeState,
    covePrototypeStateOptions,
    getPrototypeStateOption,
    getStepperIndex,
    isCovePrototypeState,
} from './cove-prototype-model.ts';

const setupStepLabels = ['Connect a Computer', 'Meet Cove', 'Onboarding Chat'];

/** Three plain rectangles — the only progress signal in the frame. */
export function SetupProgressMarker({ state }: { state: CovePrototypeState }) {
    const currentStep = getStepperIndex(state);

    return (
        <ol aria-label="Cove onboarding progress" className="cove-progress-marker">
            {setupStepLabels.map((label, index) => (
                <li aria-current={index === currentStep ? 'step' : undefined} key={label}>
                    <span
                        aria-hidden="true"
                        className={`cove-progress-marker__bar ${
                            index <= currentStep ? 'bg-accent' : 'bg-separator'
                        }`}
                    />
                    <span className="sr-only">
                        {label} ·{' '}
                        {index < currentStep
                            ? 'complete'
                            : index === currentStep
                              ? 'current'
                              : 'upcoming'}
                    </span>
                </li>
            ))}
        </ol>
    );
}

/** Review-only control. It does not ship with the production flow. */
export function ReviewStateSelect({
    onStateChange,
    state,
}: {
    onStateChange: (state: CovePrototypeState) => void;
    state: CovePrototypeState;
}) {
    return (
        <Select
            aria-label="Review prototype state"
            fullWidth
            onChange={(value) => {
                const nextState = String(value ?? '');
                if (isCovePrototypeState(nextState)) {
                    onStateChange(nextState);
                }
            }}
            value={state}
            variant="secondary"
        >
            <Select.Trigger>
                {/* The item carries a description, so the trigger has to show the label alone. */}
                <Select.Value>{() => getPrototypeStateOption(state).label}</Select.Value>
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {covePrototypeStateOptions.map((option) => (
                        <ListBox.Item id={option.id} key={option.id} textValue={option.label}>
                            <Label>{option.label}</Label>
                            <Description>{option.description}</Description>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}
