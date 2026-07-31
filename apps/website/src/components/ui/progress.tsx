'use client';

import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

export interface ProgressProps {
    'aria-label'?: string;
    className?: string;
    /** CSS color for the filled portion. */
    color?: string;
    /** 0–100; null means indeterminate. */
    value: number | null;
}

export function Progress({
    'aria-label': ariaLabel = 'Progress',
    className,
    value,
    color,
}: ProgressProps): React.ReactElement {
    return (
        <ProgressPrimitive.Root aria-label={ariaLabel} max={100} value={value}>
            <ProgressPrimitive.Track
                className={cn('h-3 w-full overflow-hidden rounded-full bg-legacy-muted', className)}
            >
                <ProgressPrimitive.Indicator
                    className={cn(
                        'h-full rounded-full bg-primary transition-transform duration-300',
                        value === null &&
                            'w-1/3 motion-safe:animate-[progress-indeterminate_1.25s_ease-in-out_infinite] motion-reduce:animate-pulse'
                    )}
                    style={{ backgroundColor: color }}
                />
            </ProgressPrimitive.Track>
        </ProgressPrimitive.Root>
    );
}
