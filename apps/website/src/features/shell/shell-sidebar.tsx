import { Sidebar } from '@heroui-pro/react';
import * as React from 'react';

export type ShellSidebarPageId = 'computers' | 'members' | 'server' | 'settings' | 'tasks';

interface ShellSidebarPageProps {
    ariaLabel: string;
    children: React.ReactNode;
    value: ShellSidebarPageId;
}

/**
 * Shell-owned contextual sidebar. Page descriptors are converted to direct
 * HeroUI Sidebar.Page children so HeroUI can calculate and animate page order.
 */
export function ShellSidebar({
    activePage,
    children,
}: {
    activePage: ShellSidebarPageId;
    children: React.ReactNode;
}) {
    const pages = React.Children.map(children, (child) => {
        if (child === null) {
            return null;
        }
        if (
            !React.isValidElement<ShellSidebarPageProps>(child) ||
            child.type !== ShellSidebarPage
        ) {
            throw new Error('ShellSidebar children must be ShellSidebarPage descriptors.');
        }
        return (
            <Sidebar.Page
                aria-label={child.props.ariaLabel}
                className="min-h-0 flex-1"
                key={child.props.value}
                value={child.props.value}
            >
                {child.props.children}
            </Sidebar.Page>
        );
    });

    return (
        <Sidebar aria-label="Server navigation">
            <Sidebar.Pages className="min-h-0 flex-1" value={activePage}>
                {pages}
            </Sidebar.Pages>
        </Sidebar>
    );
}

/** Declarative page marker consumed by ShellSidebar. */
export function ShellSidebarPage({ children }: ShellSidebarPageProps) {
    return children;
}

/**
 * Frame inside one contextual sidebar page. The header zone always renders —
 * Sidebar.Header's stock padding keeps the first row off the window edge and
 * visually inline with the shell topbar. Section pages supply content only;
 * sidebar chrome decisions live here.
 * (Sidebar.Header does not forward className; the inner wrapper shapes a
 * 32px row whose midline matches the shell topbar's.)
 */
export function ShellSidebarPageContent({
    band,
    children,
    footer,
}: {
    band?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <>
            <Sidebar.Header>
                <div className="-mt-2 flex min-h-8 w-full items-center">{band}</div>
            </Sidebar.Header>
            <Sidebar.Content>{children}</Sidebar.Content>
            {footer ? <Sidebar.Footer>{footer}</Sidebar.Footer> : null}
        </>
    );
}
