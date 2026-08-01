import { Sidebar } from '@heroui-pro/react';
import type * as React from 'react';

/**
 * Shell-owned frame for every section sidebar. The header zone always
 * renders — Sidebar.Header's stock padding is what keeps the first row
 * off the window edge and visually inline with the shell topbar — so a
 * sidebar can never sit flush against the top again. Section sidebars
 * supply content only; sidebar chrome decisions live here.
 * (Sidebar.Header does not forward className; the inner wrapper shapes a
 * 40px row whose midline matches the shell topbar's.)
 */
export function ShellSidebar({
    ariaLabel,
    band,
    children,
    footer,
}: {
    ariaLabel: string;
    band?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <Sidebar aria-label={ariaLabel}>
            <Sidebar.Header>
                <div className="-mt-2 flex min-h-10 w-full items-center">{band}</div>
            </Sidebar.Header>
            <Sidebar.Content>{children}</Sidebar.Content>
            {footer ? <Sidebar.Footer>{footer}</Sidebar.Footer> : null}
        </Sidebar>
    );
}
