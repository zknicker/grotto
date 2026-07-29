'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

/*
 * Pane — the inner shell kit. Every content column and docked side pane in
 * the app is built from these pieces so chrome rows, seams, and scroll
 * regions stay pixel-identical across pages:
 *
 *   <Pane>
 *     <PaneTopbar>…identity left, quiet controls right…</PaneTopbar>
 *     <PaneBody className="overflow-y-auto">…</PaneBody>
 *   </Pane>
 *
 * Chrome rows are always --content-topbar-height (40px) tall with the
 * bottom hairline drawn inside that height, in --content-card-border ink —
 * the same ink as every panel seam, so the frame reads as one set of
 * straight lines. Docked panes use SidePane, which owns the vertical seam.
 */

/** Vertical flex column for a content region. */
export function Pane({ className, render, ...props }: useRender.ComponentProps<'section'>) {
    const defaultProps = {
        className: cn('flex min-h-0 min-w-0 flex-1 flex-col', className),
        'data-slot': 'pane',
    };

    return useRender({
        defaultTagName: 'section',
        props: mergeProps<'section'>(defaultProps, props),
        render,
    });
}

/**
 * The one 40px chrome row. The bottom hairline is drawn inside the row's
 * height (border-box), so stacked rows and neighboring panes share exact
 * seam positions. Blank space is window-draggable; controls opt out with
 * no-drag.
 */
export function PaneTopbar({ className, render, ...props }: useRender.ComponentProps<'header'>) {
    const defaultProps = {
        className: cn(
            'relative z-40 flex h-[var(--content-topbar-height)] shrink-0 items-center gap-2 border-[var(--content-card-border)] border-b bg-background px-3',
            className
        ),
        'data-slot': 'pane-topbar',
        'data-window-drag-region': '',
    };

    return useRender({
        defaultTagName: 'header',
        props: mergeProps<'header'>(defaultProps, props),
        render,
    });
}

/** Truncating title slot for a chrome row. */
export function PaneTopbarTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('min-w-0 truncate font-semibold text-sm', className)}
            data-slot="pane-topbar-title"
            {...props}
        />
    );
}

/** The pane's content region. Owns leftover height; scrolling is opt-in. */
export function PaneBody({ className, render, ...props }: useRender.ComponentProps<'div'>) {
    const defaultProps = {
        className: cn('flex min-h-0 flex-1 flex-col', className),
        'data-slot': 'pane-body',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

/**
 * A docked side pane. Owns the vertical seam (same ink as the topbar
 * hairline) on the side facing the content it is docked against. Pass a
 * motion element through `render` for animated panes; compose
 * ResizablePaneRail as a child for resizable ones.
 */
export function SidePane({
    className,
    render,
    side = 'right',
    ...props
}: useRender.ComponentProps<'aside'> & { side?: 'left' | 'right' }) {
    const defaultProps = {
        className: cn(
            'relative flex h-full min-h-0 shrink-0 overflow-hidden border-[var(--content-card-border)] bg-background',
            side === 'right' ? 'border-l' : 'border-r',
            className
        ),
        'data-side': side,
        'data-slot': 'side-pane',
    };

    return useRender({
        defaultTagName: 'aside',
        props: mergeProps<'aside'>(defaultProps, props),
        render,
    });
}
