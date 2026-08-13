import { Sidebar } from '@heroui-pro/react';
import * as React from 'react';

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
}: {
    activePage: ShellSidebarPageId;
    children: React.ReactNode;
    footer?: React.ReactNode;
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
            {activePageContent.children}
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
