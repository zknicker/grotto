import type { HugeiconsIconProps } from '@hugeicons/react';
import type { ComponentProps, ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Field, FieldDescription, FieldLabel } from '../../../components/ui/primitives/field.tsx';
import { Form } from '../../../components/ui/primitives/form.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip.tsx';
import { cn } from '../../../lib/utils.ts';

// Reusable shell + field kit for Browser config dialogs. Mirrors the skill
// inspection dialog: circle icon, header-aligned toggle, compact fields, and a
// borderless action row at the foot of the body.

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
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent size="lg" surfaceOffset={2}>
                <Form
                    className="flex min-h-0 flex-1 flex-col gap-0"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSubmit();
                    }}
                >
                    <DialogHeader className="gap-3 pe-0">
                        <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground">
                            <Icon className="size-6" icon={icon} />
                        </div>
                        <div className="flex items-center gap-3">
                            <DialogTitle className="flex items-baseline gap-2">
                                {title}
                                {titleSuffix ? (
                                    <span className="font-normal text-muted-foreground">
                                        {titleSuffix}
                                    </span>
                                ) : null}
                            </DialogTitle>
                            {headerAction ? (
                                <span className="ml-auto flex items-center gap-2">
                                    {headerAction}
                                </span>
                            ) : null}
                        </div>
                        {description ? (
                            <DialogDescription className="text-foreground/80 leading-6">
                                {description}
                            </DialogDescription>
                        ) : null}
                    </DialogHeader>

                    <DialogPanel className="grid gap-4">
                        {children}
                        {footer ? (
                            <div className="flex items-center gap-2 pt-1">{footer}</div>
                        ) : null}
                    </DialogPanel>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export function BrowserField({
    children,
    description,
    label,
}: {
    children: ReactNode;
    description?: ReactNode;
    label: ReactNode;
}) {
    return (
        <Field render={<label />}>
            <FieldLabel render={<span />}>{label}</FieldLabel>
            {children}
            {description ? <FieldDescription>{description}</FieldDescription> : null}
        </Field>
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
                    <div className="text-muted-foreground text-sm leading-relaxed">
                        {description}
                    </div>
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
        <div
            className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                variant === 'warning' && 'border-warning/25 bg-warning/8',
                variant === 'error' && 'border-error/25 bg-error/8'
            )}
        >
            <span className="font-medium text-foreground">{title}. </span>
            <span className="text-muted-foreground">{children}</span>
        </div>
    );
}

// A switch that wraps itself in an explanatory tooltip when locked by config.
export function BrowserLockSwitch({
    locked,
    lockTooltip,
    ...props
}: ComponentProps<typeof Switch> & {
    locked: boolean;
    lockTooltip?: ReactNode;
}) {
    const control = <Switch {...props} />;

    if (!(locked && lockTooltip)) {
        return control;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
                {control}
            </TooltipTrigger>
            <TooltipContent className="max-w-64" side="left">
                {lockTooltip}
            </TooltipContent>
        </Tooltip>
    );
}
