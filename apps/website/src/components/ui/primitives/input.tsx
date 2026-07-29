'use client';

import { Input as InputPrimitive } from '@base-ui/react/input';
import type * as React from 'react';
import { cn } from '../../../lib/utils.ts';

export type InputProps = Omit<
    InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,
    'size'
> & {
    size?: 'sm' | 'default' | 'lg' | 'xl' | number;
    unstyled?: boolean;
    nativeInput?: boolean;
    /**
     * `flush` drops the field chrome — border, fill, radius, and focus ring —
     * so the input can sit as a seam-free header inside a popover or panel
     * that already draws its own edges.
     */
    variant?: 'default' | 'flush';
};

export function Input({
    className,
    size = 'default',
    unstyled = false,
    nativeInput = false,
    variant = 'default',
    ...props
}: InputProps): React.ReactElement {
    const inputClassName = cn(
        'h-full w-full min-w-0 cursor-text rounded-[inherit] px-3 outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-muted-foreground/72',
        size === 'sm' && 'px-2.5 text-sm',
        size !== 'sm' && 'text-sm',
        props.type === 'search' &&
            '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none',
        props.type === 'file' &&
            'text-muted-foreground file:me-3 file:bg-transparent file:font-medium file:text-foreground file:text-sm'
    );

    return (
        <span
            className={
                cn(
                    !unstyled && 'relative inline-flex w-full cursor-text text-foreground',
                    !unstyled &&
                        variant === 'default' &&
                        'rounded-lg border border-border/70 bg-muted/55 ring-ring/24 transition-[background-color,border-color,box-shadow] hover:border-border hover:bg-muted/80 has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-autofill:bg-muted/80 has-disabled:opacity-64 has-focus-visible:ring-[3px] dark:border-border/55 dark:bg-input/45 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:hover:border-border/75 dark:hover:bg-input/60',
                    !unstyled && variant === 'flush' && 'bg-transparent has-disabled:opacity-64',
                    !unstyled && size === 'default' && 'h-8',
                    !unstyled && size === 'sm' && 'h-7',
                    !unstyled && size === 'lg' && 'h-10 sm:h-9',
                    !unstyled && size === 'xl' && 'h-11',
                    className
                ) || undefined
            }
            data-size={size}
            data-slot="input-control"
        >
            {nativeInput ? (
                <input
                    className={inputClassName}
                    data-slot="input"
                    size={typeof size === 'number' ? size : undefined}
                    {...props}
                />
            ) : (
                <InputPrimitive
                    className={inputClassName}
                    data-slot="input"
                    size={typeof size === 'number' ? size : undefined}
                    {...props}
                />
            )}
        </span>
    );
}

export { InputPrimitive };
