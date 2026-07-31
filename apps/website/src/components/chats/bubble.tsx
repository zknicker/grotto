import type * as React from 'react';

import { cn } from '../../lib/utils.ts';

/**
 * The transcript is a Slack-style roster: every row renders ghost, so a
 * bubble is a plain text block rather than a chat balloon. `data-slot` and
 * `data-variant` stay on the DOM — the transcript tests and the message
 * layout selectors key off them.
 */
function Bubble({
    align = 'start',
    className,
    ...props
}: React.ComponentProps<'div'> & { align?: 'start' | 'end' }) {
    return (
        <div
            className={cn(
                'group/bubble relative flex w-fit min-w-0 max-w-full flex-col gap-1 border-none data-[align=end]:self-end group-data-[align=end]/message:self-end',
                className
            )}
            data-align={align}
            data-slot="bubble"
            data-variant="ghost"
            {...props}
        />
    );
}

function BubbleContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'wrap-break-word w-fit min-w-0 max-w-full overflow-hidden text-sm leading-relaxed group-data-[align=end]/bubble:self-end',
                className
            )}
            data-slot="bubble-content"
            {...props}
        />
    );
}

export { Bubble, BubbleContent };
