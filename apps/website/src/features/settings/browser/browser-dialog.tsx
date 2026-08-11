import {
    Alert,
    Button,
    Description,
    FieldError,
    Form,
    Label,
    Modal,
    Switch,
    TextField,
    Tooltip,
} from '@heroui/react';
import type { HugeiconsIconProps } from '@hugeicons/react';
import type { ReactNode } from 'react';
import { Icon } from '../../../components/ui/icon.tsx';

// Reusable shell + field composition for Browser config dialogs.

// Footer submit buttons live outside the form; associate them via form={BROWSER_DIALOG_FORM_ID}.
export const BROWSER_DIALOG_FORM_ID = 'browser-dialog-form';

export function BrowserDialog({
    children,
    description,
    footer,
    headerAction,
    icon,
    onOpenChange,
    onSubmit,
    open,
    title,
    titleSuffix,
}: {
    children: ReactNode;
    description?: ReactNode;
    footer?: ReactNode;
    headerAction?: ReactNode;
    icon: HugeiconsIconProps['icon'];
    onOpenChange: (open: boolean) => void;
    onSubmit: () => void;
    open: boolean;
    title: ReactNode;
    titleSuffix?: ReactNode;
}) {
    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop isDismissable>
                <Modal.Container scroll="outside" size="lg">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Icon>
                                <Icon icon={icon} />
                            </Modal.Icon>
                            <div className="flex items-center gap-3">
                                <Modal.Heading>
                                    {title}
                                    {titleSuffix ? ` ${titleSuffix}` : null}
                                </Modal.Heading>
                                {headerAction ? (
                                    <span className="ms-auto shrink-0">{headerAction}</span>
                                ) : null}
                            </div>
                            {description ? (
                                <p className="mt-1.5 text-muted text-sm leading-5">{description}</p>
                            ) : null}
                        </Modal.Header>
                        <Modal.Body>
                            <Form
                                id={BROWSER_DIALOG_FORM_ID}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    onSubmit();
                                }}
                            >
                                {children}
                            </Form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" type="button" variant="secondary">
                                Cancel
                            </Button>
                            {footer}
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

export function BrowserField({
    children,
    description,
    error,
    label,
}: {
    children: ReactNode;
    description?: ReactNode;
    error?: ReactNode;
    label: ReactNode;
}) {
    return (
        <TextField fullWidth isInvalid={Boolean(error)} variant="secondary">
            <Label>{label}</Label>
            {children}
            {description ? <Description>{description}</Description> : null}
            {error ? <FieldError>{error}</FieldError> : null}
        </TextField>
    );
}

// Lays out two or more fields side by side, collapsing to one column when narrow.
export function BrowserFieldRow({ children }: { children: ReactNode }) {
    return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function BrowserToggleField({
    control,
    description,
    label,
}: {
    control: ReactNode;
    description?: ReactNode;
    label: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
                <div className="text-foreground text-sm">{label}</div>
                {description ? (
                    <div className="text-muted text-sm leading-relaxed">{description}</div>
                ) : null}
            </div>
            {control}
        </div>
    );
}

export function BrowserNotice({
    children,
    title,
    variant = 'warning',
}: {
    children: ReactNode;
    title: ReactNode;
    variant?: 'warning' | 'error';
}) {
    return (
        <Alert status={variant === 'error' ? 'danger' : 'warning'}>
            <Alert.Content>
                <Alert.Title>{title}</Alert.Title>
                <Alert.Description>{children}</Alert.Description>
            </Alert.Content>
        </Alert>
    );
}

// A switch that wraps itself in an explanatory tooltip when locked by config.
export function BrowserLockSwitch({
    'aria-label': ariaLabel,
    checked,
    disabled,
    locked,
    lockTooltip,
    onCheckedChange,
}: {
    'aria-label': string;
    checked: boolean;
    disabled: boolean;
    locked: boolean;
    lockTooltip?: ReactNode;
    onCheckedChange: (checked: boolean) => void;
}) {
    const control = (
        <Switch
            aria-label={ariaLabel}
            isDisabled={disabled || locked}
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

    if (!(locked && lockTooltip)) {
        return control;
    }

    return (
        <Tooltip delay={0}>
            <Tooltip.Trigger>{control}</Tooltip.Trigger>
            <Tooltip.Content placement="left">{lockTooltip}</Tooltip.Content>
        </Tooltip>
    );
}
