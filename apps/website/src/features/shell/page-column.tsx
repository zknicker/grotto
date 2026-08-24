import type * as React from 'react';
import { cn } from '../../lib/utils.ts';

/**
 * The one content column for routed destinations, encoding HeroUI's page idiom
 * (`mx-auto flex w-full flex-col gap-8 p-6`) against our spacing token.
 *
 * It owns three things so nothing below it has to: the page gutter, the max
 * width, and the rhythm between sections. Modules inside it — Widget,
 * ItemCardGroup, Card — already carry their own header and content padding, so
 * they are dropped in directly rather than wrapped in padded `<section>`s.
 * Doubling padding between a parent and its children is what drove page spacing
 * to 15px on one destination and 40px on another.
 *
 * Chat is deliberately exempt: it is a full-height surface with its own scroll
 * and composer geometry, not a document column.
 */
export function PageColumn({
    className,
    width = 'default',
    ...props
}: React.ComponentProps<'div'> & { width?: PageColumnWidth }) {
    return (
        <div
            className={cn(
                // px-6 is the content reading gutter — deeper than the shell
                // band's px-3 chrome gutter; pt-8 gives the page header room
                // to breathe.
                'mx-auto flex w-full flex-col gap-8 px-6 pt-8 pb-16',
                pageColumnWidthClassName[width],
                className
            )}
            {...props}
        />
    );
}

export type PageColumnWidth = 'default' | 'full' | 'wide';

/** Width is a named variant, not a call-site `max-w-[…]` override. */
const pageColumnWidthClassName = {
    default: 'max-w-3xl',
    full: 'max-w-none',
    wide: 'max-w-7xl',
} satisfies Record<PageColumnWidth, string>;
