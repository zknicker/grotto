'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import { Spinner } from '../spinner.tsx';

/* Brutalist press: a hard 3px slab under the button that collapses on press
   while the button drops into it. Applied to solid/bordered variants only —
   ghost, link, soft, and chrome stay flush. */
const hardPress =
    'not-disabled:shadow-[0_3px_0_0_var(--hard-shadow)] [:active,[data-pressed]]:translate-y-[3px] [:active,[data-pressed]]:shadow-none';

export const buttonVariants = cva(
    "no-drag relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 data-loading:select-none data-loading:text-transparent sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
    {
        defaultVariants: {
            size: 'default',
            variant: 'default',
        },
        variants: {
            size: {
                default: 'h-9 px-[calc(--spacing(3)-1px)] sm:h-8',
                icon: 'size-9 sm:size-8',
                'icon-tight':
                    "size-9 rounded-full before:rounded-full sm:size-8 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-5",
                'icon-lg': 'size-10 sm:size-9',
                'icon-sm': 'size-7',
                'icon-xl':
                    "size-11 sm:size-10 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
                'icon-xs':
                    "size-7 rounded-md before:rounded-[calc(var(--radius-md)-1px)] sm:size-6 not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-4 sm:not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-3.5",
                lg: 'h-10 px-[calc(--spacing(3.5)-1px)] sm:h-9',
                sm: 'h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:h-7',
                xl: "h-11 px-[calc(--spacing(4)-1px)] text-lg sm:h-10 sm:text-base [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
                xs: "h-6 gap-1 rounded-md px-[calc(--spacing(1.5)-1px)] font-normal text-sm before:rounded-[calc(var(--radius-md)-1px)] sm:h-5 sm:text-[0.8125rem] [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
            },
            variant: {
                brand: `border-brand bg-brand text-brand-foreground hover:bg-brand/90 data-pressed:bg-brand/85 *:data-[slot=button-loading-indicator]:text-brand-foreground ${hardPress}`,
                'brand-soft':
                    'border-transparent bg-brand/12 text-brand shadow-none hover:bg-brand/18 disabled:opacity-100 data-pressed:bg-brand/22 *:data-[slot=button-loading-indicator]:text-brand',
                chrome: 'border-border/60 bg-legacy-muted/22 text-[var(--sidebar-icon-muted)] hover:border-border/85 hover:bg-legacy-muted/44 hover:text-[var(--sidebar-icon-muted)] disabled:border-border/30 disabled:bg-legacy-muted/10 disabled:text-[var(--sidebar-icon-muted)] disabled:opacity-100 [&_svg]:opacity-100',
                default: `border-primary bg-primary text-primary-foreground hover:bg-primary/90 data-pressed:bg-primary/85 *:data-[slot=button-loading-indicator]:text-primary-foreground ${hardPress}`,
                destructive: `border-destructive bg-destructive text-white hover:bg-destructive/90 data-pressed:bg-destructive/85 *:data-[slot=button-loading-indicator]:text-white ${hardPress}`,
                'destructive-outline': `border-input bg-popover text-destructive-foreground hover:border-destructive/40 hover:bg-destructive/4 data-pressed:border-destructive/40 data-pressed:bg-destructive/4 *:data-[slot=button-loading-indicator]:text-foreground ${hardPress}`,
                'destructive-ghost':
                    'border-transparent text-destructive-foreground hover:bg-destructive/4 data-pressed:bg-destructive/4 *:data-[slot=button-loading-indicator]:text-foreground',
                'destructive-soft':
                    'border-transparent bg-[color-mix(in_srgb,var(--error-bg),transparent_45%)] text-error-foreground hover:bg-[color-mix(in_srgb,var(--error-bg),transparent_15%)] data-pressed:bg-error-bg *:data-[slot=button-loading-indicator]:text-error-foreground',
                ghost: 'border-transparent text-foreground hover:bg-legacy-accent data-pressed:bg-legacy-accent *:data-[slot=button-loading-indicator]:text-foreground',
                link: 'border-transparent text-foreground underline-offset-4 hover:underline data-pressed:underline *:data-[slot=button-loading-indicator]:text-foreground',
                outline: `border-input bg-popover text-foreground hover:bg-legacy-accent/50 *:data-[slot=button-loading-indicator]:text-foreground ${hardPress}`,
                secondary: `border-input bg-secondary text-secondary-foreground hover:bg-(--secondary-hover) *:data-[slot=button-loading-indicator]:text-secondary-foreground [:active,[data-pressed]]:bg-(--secondary-hover) ${hardPress}`,
            },
        },
    }
);

export interface ButtonProps extends useRender.ComponentProps<'button'> {
    loading?: boolean;
    size?: VariantProps<typeof buttonVariants>['size'];
    variant?: VariantProps<typeof buttonVariants>['variant'];
}

export function Button({
    className,
    variant,
    size,
    render,
    children,
    loading = false,
    disabled: disabledProp,
    ...props
}: ButtonProps): React.ReactElement {
    const isDisabled: boolean = Boolean(loading || disabledProp);
    const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] = render
        ? undefined
        : 'button';

    const defaultProps = {
        children: (
            <>
                {children}
                {loading && (
                    <Spinner
                        className="pointer-events-none absolute"
                        data-slot="button-loading-indicator"
                    />
                )}
            </>
        ),
        className: cn(buttonVariants({ className, size, variant })),
        'aria-disabled': loading || undefined,
        'data-loading': loading ? '' : undefined,
        'data-slot': 'button',
        disabled: isDisabled,
        type: typeValue,
    };

    return useRender({
        defaultTagName: 'button',
        props: mergeProps<'button'>(defaultProps, props),
        render,
    });
}
