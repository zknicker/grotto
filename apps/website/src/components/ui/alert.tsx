'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

export const alertVariants = cva(
    'relative grid w-full grid-cols-1 rounded-lg border px-3 py-2.5 text-sm has-[>svg]:grid-cols-[auto_minmax(0,1fr)] has-[>svg]:gap-x-3 [&>[data-slot=alert-action]]:col-start-1 has-[>svg]:[&>[data-slot=alert-action]]:col-start-2 [&>[data-slot=alert-description]]:col-start-1 has-[>svg]:[&>[data-slot=alert-description]]:col-start-2 [&>[data-slot=alert-title]]:col-start-1 has-[>svg]:[&>[data-slot=alert-title]]:col-start-2 [&>svg]:col-start-1 [&>svg]:row-span-2 [&>svg]:mt-0.5 [&>svg]:size-4.5 [&>svg]:shrink-0',
    {
        defaultVariants: {
            variant: 'default',
        },
        variants: {
            variant: {
                default: 'border-border-subtle bg-muted [&>svg]:text-muted-foreground',
                error: 'border-[color:var(--error-border)] bg-[var(--error-bg)] [&>[data-slot=alert-description]]:text-error-foreground [&>svg]:text-error',
                info: 'border-[color:var(--info-border)] bg-[var(--info-bg)] [&>svg]:text-info',
                success:
                    'border-[color:var(--success-border)] bg-[var(--success-bg)] [&>svg]:text-success',
                warning:
                    'border-[color:var(--warning-border)] bg-[var(--warning-bg)] [&>svg]:text-warning',
            },
        },
    }
);

export type AlertVariant = NonNullable<VariantProps<typeof alertVariants>['variant']>;

export interface AlertProps extends React.ComponentProps<'div'> {
    variant?: AlertVariant;
}

export function Alert({ className, variant, ...props }: AlertProps): React.ReactElement {
    return (
        <div
            className={cn(alertVariants({ className, variant }))}
            data-slot="alert"
            role="alert"
            {...props}
        />
    );
}

export function AlertTitle({
    className,
    ...props
}: React.ComponentProps<'div'>): React.ReactElement {
    return (
        <div
            className={cn('font-medium text-foreground text-sm leading-5', className)}
            data-slot="alert-title"
            {...props}
        />
    );
}

export function AlertDescription({
    className,
    ...props
}: React.ComponentProps<'div'>): React.ReactElement {
    return (
        <div
            className={cn('text-muted-foreground text-sm leading-5', className)}
            data-slot="alert-description"
            {...props}
        />
    );
}

export function AlertAction({
    className,
    ...props
}: React.ComponentProps<'div'>): React.ReactElement {
    return (
        <div
            className={cn('mt-2 flex items-center gap-2 sm:justify-self-end', className)}
            data-slot="alert-action"
            {...props}
        />
    );
}
