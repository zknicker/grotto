import { Tooltip } from '@heroui/react';
import type * as React from 'react';

/**
 * Zero-delay tooltip for the message actions bar: the bar hides the instant
 * the pointer leaves its row, so its tooltips must appear and vanish with it
 * instead of lingering on the stock close delay.
 */
export function ActionTooltip({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <Tooltip closeDelay={0} delay={0}>
            <Tooltip.Trigger>{children}</Tooltip.Trigger>
            <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip>
    );
}
