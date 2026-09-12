import { useScrollShadow } from '@heroui/react';
import type { ReactNode } from 'react';
import * as React from 'react';

/**
 * The scrolling track the week cards ride.
 *
 * It bleeds through the page gutter so the last card runs off the reading
 * edge rather than stopping short of it — the cut-off card is what tells a
 * reader the row keeps going. Stock `useScrollShadow` drives the edge fade off
 * scroll position, so the strip keeps owning its own snap scrolling.
 */
export function AgentWeekStrip({ children }: { children: ReactNode }) {
    const containerRef = React.useRef<HTMLDivElement>(null);

    useScrollShadow({
        containerRef: containerRef as React.RefObject<HTMLElement>,
        isEnabled: true,
        offset: 0,
        orientation: 'horizontal',
        visibility: 'auto',
    });

    return (
        <div
            className="scroll-shadow scroll-shadow--fade scroll-shadow--horizontal scrollbar-none -mx-6 flex snap-x scroll-px-6 gap-3 overflow-x-auto overscroll-x-contain px-6 py-1"
            ref={containerRef}
        >
            {children}
        </div>
    );
}
