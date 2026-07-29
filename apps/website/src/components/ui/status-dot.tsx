import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

/**
 * Semantic status dot. Solid tokens only — no alpha washes. `pulse` adds the
 * live ping ring (inherits the dot's fill); pass `className` for ring or
 * offset treatments, e.g. a presence dot sitting on an avatar.
 */
export const statusDotVariants = cva('relative inline-flex shrink-0 rounded-full', {
    defaultVariants: {
        size: 'sm',
        status: 'muted',
    },
    variants: {
        size: {
            md: 'size-2.5',
            sm: 'size-2',
        },
        status: {
            error: 'bg-error',
            info: 'bg-info',
            muted: 'bg-foreground-quaternary',
            success: 'bg-success',
            warning: 'bg-warning',
        },
    },
});

export interface StatusDotProps
    extends React.ComponentProps<'span'>,
        VariantProps<typeof statusDotVariants> {
    pulse?: boolean;
}

export function StatusDot({
    className,
    pulse = false,
    size,
    status,
    ...props
}: StatusDotProps): React.ReactElement {
    return (
        <span
            aria-hidden
            className={cn(statusDotVariants({ size, status }), className)}
            data-slot="status-dot"
            {...props}
        >
            {pulse ? (
                <span className="absolute inset-0 rounded-full bg-inherit opacity-60 motion-safe:animate-ping" />
            ) : null}
        </span>
    );
}
