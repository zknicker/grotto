import { Switch, Tooltip } from '@heroui/react';

/**
 * Browser enable switch that locks with a hover tooltip instead of an inline
 * badge when the tool cannot be enabled yet.
 */
export function BrowserEnablementSwitch({
    'aria-label': ariaLabel,
    checked,
    disabled,
    lockReason,
    onCheckedChange,
}: {
    'aria-label': string;
    checked: boolean;
    disabled: boolean;
    lockReason: string | null;
    onCheckedChange: (checked: boolean) => void;
}) {
    const control = (
        <Switch
            aria-label={ariaLabel}
            isDisabled={disabled || Boolean(lockReason)}
            isSelected={checked}
            onChange={onCheckedChange}
        >
            <Switch.Content>
                <Switch.Control>
                    <Switch.Thumb />
                </Switch.Control>
            </Switch.Content>
        </Switch>
    );

    if (!lockReason) {
        return control;
    }

    return (
        <Tooltip delay={0}>
            <Tooltip.Trigger>{control}</Tooltip.Trigger>
            <Tooltip.Content placement="left">{lockReason}</Tooltip.Content>
        </Tooltip>
    );
}
