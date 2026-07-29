'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

export const badgeVariants = cva(
    "relative inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm border border-transparent font-medium font-mono uppercase tracking-wide outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [button&,a&]:cursor-pointer [button&,a&]:pointer-coarse:after:absolute [button&,a&]:pointer-coarse:after:size-full [button&,a&]:pointer-coarse:after:min-h-11 [button&,a&]:pointer-coarse:after:min-w-11",
    {
        defaultVariants: {
            size: 'default',
            variant: 'default',
        },
        variants: {
            size: {
                /* Label chip: a roomier badge that carries an icon plus a
                   truncating label (chat and session badges). */
                chip: 'h-7 min-w-0 gap-1.5 rounded-md px-1.5 text-sm',
                default:
                    'h-5.5 min-w-5.5 px-[calc(--spacing(1)-1px)] text-sm sm:h-4.5 sm:min-w-4.5 sm:text-xs',
                lg: 'h-6.5 min-w-6.5 px-[calc(--spacing(1.5)-1px)] text-base sm:h-5.5 sm:min-w-5.5 sm:text-sm',
                sm: 'h-5 min-w-5 rounded-[.25rem] px-[calc(--spacing(1)-1px)] text-xs sm:h-4.5 sm:min-w-4.5 sm:text-caption',
            },
            variant: {
                brand: 'border-brand/60 bg-brand/16 text-brand-muted-foreground dark:border-brand/65 dark:bg-brand/32',
                /* Quiet plate for label chips: same fill as `secondary`, but a
                   lighter hairline so the chip reads as content, not a control. */
                chip: 'border-border-subtle bg-secondary text-foreground',
                default: 'bg-primary text-primary-foreground [button&,a&]:hover:bg-primary/90',
                destructive: 'bg-destructive text-white [button&,a&]:hover:bg-destructive/90',
                error: 'border-destructive/60 bg-destructive/16 text-destructive-foreground dark:border-destructive/55 dark:bg-destructive/30',
                info: 'border-info/60 bg-info/16 text-info-foreground dark:border-info/55 dark:bg-info/30',
                secondary:
                    'border-input bg-secondary text-secondary-foreground [button&,a&]:hover:bg-(--secondary-hover)',
                subtle: 'border-border bg-subtle text-foreground/75',
                success:
                    'border-success/60 bg-success/16 text-success-foreground dark:border-success/55 dark:bg-success/30',
                warning:
                    'border-warning/65 bg-warning/18 text-warning-foreground dark:border-warning/55 dark:bg-warning/30',
            },
        },
    }
);

export interface BadgeProps extends useRender.ComponentProps<'span'> {
    size?: VariantProps<typeof badgeVariants>['size'];
    variant?: VariantProps<typeof badgeVariants>['variant'];
}

export function Badge({
    className,
    variant,
    size,
    render,
    ...props
}: BadgeProps): React.ReactElement {
    const defaultProps = {
        className: cn(badgeVariants({ className, size, variant })),
        'data-slot': 'badge',
    };

    return useRender({
        defaultTagName: 'span',
        props: mergeProps<'span'>(defaultProps, props),
        render,
    });
}

// Preserve the legacy export name while callers migrate to Badge.
export const CustomBadge = Badge;

/** Map a state string (e.g. "running", "failed") to the right badge variant. */
export function stateToBadgeVariant(state: string): BadgeProps['variant'] {
    switch (state) {
        case 'running':
        case 'enabled':
            return 'default';
        case 'failed':
        case 'error':
            return 'destructive';
        case 'healthy':
        case 'success':
            return 'success';
        case 'info':
            return 'info';
        case 'warn':
        case 'warning':
            return 'warning';
        case 'done':
        case 'debug':
            return 'secondary';
        default:
            return 'secondary';
    }
}
