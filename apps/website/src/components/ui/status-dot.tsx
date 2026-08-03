import type React from 'react';
import { cn } from '../../lib/utils.ts';

const statusFills = {
    error: 'bg-danger',
    info: 'bg-accent',
    muted: 'bg-foreground-quaternary',
    success: 'bg-success',
    warning: 'bg-warning',
} as const;

const dotSizes = {
    md: 'size-2.5',
    sm: 'size-2',
} as const;

export interface StatusDotProps extends React.ComponentProps<'span'> {
    pulse?: boolean;
    size?: keyof typeof dotSizes;
    status?: keyof typeof statusFills;
}

/**
 * Semantic status dot. Solid tokens only — no alpha washes. `pulse` adds the
 * live ping ring (inherits the dot's fill); pass `className` for ring or
 * offset treatments, e.g. a presence dot sitting on an avatar.
 */
export function StatusDot({
    className,
    pulse = false,
    size = 'sm',
    status = 'muted',
    ...props
}: StatusDotProps): React.ReactElement {
    return (
        <span
            aria-hidden
            className={cn(
                'relative inline-flex shrink-0 rounded-full',
                dotSizes[size],
                statusFills[status],
                className
            )}
            data-slot="status-dot"
            {...props}
        >
            {pulse ? (
                <span className="absolute inset-0 rounded-full bg-inherit opacity-60 motion-safe:animate-ping" />
            ) : null}
        </span>
    );
}
