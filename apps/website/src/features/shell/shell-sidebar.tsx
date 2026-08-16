import { Sidebar } from '@heroui-pro/react';
import * as React from 'react';
import { useIsDesktopApp } from '../../hooks/shell/use-is-desktop-app.ts';

export type ShellSidebarPageId = 'computers' | 'members' | 'server' | 'settings' | 'tasks';

interface ShellSidebarPageProps {
    ariaLabel: string;
    children: React.ReactNode;
    value: ShellSidebarPageId;
}

/** Shell-owned contextual sidebar. Route changes replace the left page instantly. */
export function ShellSidebar({
    activePage,
    children,
    footer,
    header,
}: {
    activePage: ShellSidebarPageId;
    children: React.ReactNode;
    footer?: React.ReactNode;
    header?: React.ReactNode;
}) {
    const isDesktopApp = useIsDesktopApp();
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
            {header ? (
                <ShellSidebarSearchSlot isDesktopApp={isDesktopApp}>
                    {header}
                </ShellSidebarSearchSlot>
            ) : null}
            {activePageContent.children}
            {footer ? <Sidebar.Footer>{footer}</Sidebar.Footer> : null}
        </Sidebar>
    );
}

/**
 * Where the search trigger sits. The desktop App hoists it into the window's
 * titlebar band, beside the macOS traffic lights. The browser has no such band,
 * so it belongs to the sidebar's own list — sharing the content gutter with the
 * rows beneath it rather than sitting in a separate zone above them.
 */
function ShellSidebarSearchSlot({
    children,
    isDesktopApp,
}: {
    children: React.ReactNode;
    isDesktopApp: boolean;
}) {
    if (isDesktopApp) {
        return <div className="app-shell-titlebar-slot">{children}</div>;
    }

    // Centred in the shell's band height, the same way the rail's server
    // avatar and the content topbar's controls are — so all three columns'
    // first element shares one midline.
    return (
        <div className="flex h-[var(--app-shell-band-height)] items-center px-3">{children}</div>
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
    band: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <>
            <Sidebar.Header>
                <div className="-mx-1 -mt-2 flex min-h-8 items-center">{band}</div>
            </Sidebar.Header>
            <Sidebar.Content>{children}</Sidebar.Content>
        </>
    );
}
