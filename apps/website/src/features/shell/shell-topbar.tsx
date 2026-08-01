import * as React from 'react';
import { createPortal } from 'react-dom';
import { SectionBar } from './section-header.tsx';

interface TopbarSlot {
    container: HTMLElement | null;
    setContainer: (element: HTMLElement | null) => void;
}

const TopbarContext = React.createContext<TopbarSlot | null>(null);

/** Owns the shell topbar slot; wrap the layout that renders ShellTopbar. */
export function TopbarProvider({ children }: { children: React.ReactNode }) {
    const [container, setContainer] = React.useState<HTMLElement | null>(null);
    const slot = React.useMemo<TopbarSlot>(() => ({ container, setContainer }), [container]);
    return <TopbarContext value={slot}>{children}</TopbarContext>;
}

/**
 * The shell's one topbar band above the routed content. Pages fill it
 * through PageTopbar; the band (and its height) render even while a page
 * registers nothing, so chrome never jumps between routes.
 */
export function ShellTopbar() {
    const slot = React.use(TopbarContext);
    return (
        <SectionBar>
            <div className="flex h-full min-w-0 flex-1 items-center" ref={slot?.setContainer} />
        </SectionBar>
    );
}

/**
 * Portals its children into the shell topbar band. Render one per routed
 * page; children compose SectionHeader (or any band content) as usual.
 */
export function PageTopbar({ children }: { children: React.ReactNode }) {
    const slot = React.use(TopbarContext);

    if (!slot?.container) {
        return null;
    }

    return createPortal(children, slot.container);
}
