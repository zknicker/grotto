import * as React from 'react';
import { cn } from '../../lib/utils.ts';

/**
 * Collapses a live card out of the timeline instead of popping it away. A
 * prepared action goes from on-screen to superseded while the human is
 * looking at it, so the row height and opacity animate together over
 * ~200ms; `onExited` fires once the collapse finishes and the caller
 * unmounts for good. Reduced motion skips straight to `onExited`.
 */
export function ActionCardExit({
    children,
    onExited,
}: {
    children: React.ReactNode;
    onExited: () => void;
}) {
    const [collapsed, setCollapsed] = React.useState(false);

    React.useEffect(() => {
        if (prefersReducedMotion()) {
            onExited();
            return;
        }
        setCollapsed(true);
    }, [onExited]);

    React.useEffect(() => {
        if (!collapsed) {
            return;
        }
        // Fallback in case the transition never fires (hidden tab, no
        // matching transition property) so the row never gets stuck.
        const fallback = setTimeout(onExited, 320);
        return () => clearTimeout(fallback);
    }, [collapsed, onExited]);

    return (
        <div
            className={cn(
                'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
                collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
            )}
            onTransitionEnd={(event) => {
                if (event.propertyName === 'grid-template-rows') {
                    onExited();
                }
            }}
        >
            <div className="min-h-0 overflow-hidden">{children}</div>
        </div>
    );
}

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}
