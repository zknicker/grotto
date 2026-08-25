import { Sidebar } from '@heroui-pro/react';
import * as React from 'react';

/**
 * HeroUI's compact-sidebar spacing, taken from the design system's own scale
 * rather than a frozen literal, so a global density retune reaches it. Scoped to
 * the navigation rows rather than the whole Sidebar: HeroUI's Button rule sizes
 * its own glyphs as `size-4`, a spacing multiple, so scoping the element would
 * silently shrink every icon button in the header band and footer along with
 * the rows. Density moves whitespace, not iconography.
 */
const sidebarDensity = 'var(--spacing-compact)';

export type ShellSidebarPageId = 'members' | 'server' | 'settings' | 'tasks';

interface ShellSidebarPageProps {
    ariaLabel: string;
    children: React.ReactNode;
    value: ShellSidebarPageId;
}

/** Shell-owned contextual sidebar. Route changes replace the left page instantly. */
export function ShellSidebar({
    activePage,
    back,
    children,
    footer,
    identity,
}: {
    activePage: ShellSidebarPageId;
    /** Escape affordance rendered above non-chat pages (settings, tasks…). */
    back?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    /** Server identity row leading the sidebar on every page. */
    identity?: React.ReactNode;
}) {
    let activePageContent: ShellSidebarPageProps | undefined;
    React.Children.forEach(children, (child) => {
        if (child === null) {
            return;
        }
        if (!React.isValidElement<ShellSidebarPageProps>(child)) {
            throw new Error('ShellSidebar children must be ShellSidebarPage descriptors.');
        }
        if (child.props.value === activePage) {
            activePageContent = child.props;
        }
    });

    if (!activePageContent) {
        throw new Error(`ShellSidebar is missing its active ${activePage} page.`);
    }

    return (
        <Sidebar aria-label={activePageContent.ariaLabel}>
            {identity}
            {/* `contents` carries the scale to every navigation row without adding a box. */}
            <div
                className="contents"
                style={{ '--spacing': sidebarDensity } as React.CSSProperties}
            >
                {back}
                {activePageContent.children}
            </div>
            {footer ? <Sidebar.Footer>{footer}</Sidebar.Footer> : null}
        </Sidebar>
    );
}

/** Declarative page marker consumed by ShellSidebar. */
export function ShellSidebarPage({ children }: ShellSidebarPageProps) {
    return children;
}

/**
 * Frame inside one contextual sidebar page. Every page supplies a semantic
 * header band; Sidebar.Header's stock padding keeps it visually inline with
 * the shell topbar instead of approximating that alignment in scrollable content.
 * (Sidebar.Header does not forward className; the inner wrapper shapes a
 * 32px row whose midline matches the shell topbar's.)
 */
export function ShellSidebarPageContent({
    band,
    children,
}: {
    band?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <>
            {band ? (
                <Sidebar.Header>
                    <div className="-mx-1 -mt-2 flex min-h-8 items-center">{band}</div>
                </Sidebar.Header>
            ) : null}
            <Sidebar.Content>{children}</Sidebar.Content>
        </>
    );
}
