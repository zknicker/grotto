import { Sidebar } from '@heroui-pro/react';
import * as React from 'react';
import { ResizablePaneRail } from '../../components/ui/resizable-pane-rail.tsx';
import {
    appSidebarWidthLimits,
    useAppSidebarWidth,
} from '../../hooks/shell/use-app-sidebar-width.ts';

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
    children,
    footer,
    settingsAction,
}: {
    activePage: ShellSidebarPageId;
    children: React.ReactNode;
    footer?: React.ReactNode;
    /**
     * The sidebar's one piece of chrome. Where it lands is the shell's
     * business, not the action's: the macOS titlebar strip, or the footer's
     * trailing end everywhere else.
     */
    settingsAction?: React.ReactNode;
}) {
    // The sidebar resizes like every pane: drag its trailing edge. The width
    // lives in a shared store because the token must be set above HeroUI's
    // offcanvas wrapper (see the AppLayout host), while the rail lives here.
    const sidebarWidth = useAppSidebarWidth();
    const settingsSlot = resolveSettingsActionSlot();
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
        <Sidebar aria-label={activePageContent.ariaLabel} className="relative">
            <ResizablePaneRail
                aria-label="Resize sidebar"
                maxWidth={appSidebarWidthLimits.max}
                minWidth={appSidebarWidthLimits.min}
                onResizeEnd={() => sidebarWidth.setResizing(false)}
                onResizeStart={() => sidebarWidth.setResizing(true)}
                onWidthChange={sidebarWidth.setWidth}
                onWidthCommit={sidebarWidth.persistWidth}
                side="right"
                title="Resize sidebar"
                width={sidebarWidth.width}
            />
            {settingsSlot === 'titlebar' ? settingsAction : null}
            {/* `contents` carries the scale to every navigation row without adding a box. */}
            <div
                className="contents"
                style={{ '--spacing': sidebarDensity } as React.CSSProperties}
            >
                {activePageContent.children}
            </div>
            {footer || settingsSlot === 'footer' ? (
                <Sidebar.Footer>
                    {/* One line: live Agent activity reads from the leading
                        edge, Settings sits at the trailing one. `items-end`
                        keeps the gear on the strip's last row, and on its own
                        line at the sidebar's bottom-right when the strip has
                        nothing to say. */}
                    <div className="flex w-full items-end gap-2">
                        <div className="min-w-0 flex-1">{footer}</div>
                        {settingsSlot === 'footer' ? settingsAction : null}
                    </div>
                </Sidebar.Footer>
            ) : null}
        </Sidebar>
    );
}

/**
 * Where the Settings gear goes.
 *
 * macOS reserves a titlebar strip beside the traffic lights, and the gear is
 * the only thing that ever rides in it; `shell.css` floats it there. Every
 * other surface has no strip, and floating the gear over the lead row's
 * trailing end made Inbox and Settings share a line — so there it is an
 * ordinary footer item instead, rendered where it is drawn so the tab order
 * follows the eye on both surfaces.
 *
 * The signal is the class `main.tsx` already stamps on the root for the same
 * platform split in CSS, read once at render: it is set before the app mounts
 * and never toggles afterwards.
 */
function resolveSettingsActionSlot(): 'footer' | 'titlebar' {
    return typeof document !== 'undefined' &&
        document.documentElement.classList.contains('macos-electron')
        ? 'titlebar'
        : 'footer';
}

/** Declarative page marker consumed by ShellSidebar. */
export function ShellSidebarPage({ children }: ShellSidebarPageProps) {
    return children;
}

/**
 * Frame inside one contextual sidebar page: the page's groups, in the
 * sidebar's scrollable content.
 *
 * No page carries a header band. A sidebar page leads with a navigation row —
 * Inbox in chat navigation, Back on the settings pages — and `shell.css` puts
 * that first row in the shared shell band, so its midline meets the content
 * topbar's across the divider without a band element to approximate it.
 */
export function ShellSidebarPageContent({ children }: { children: React.ReactNode }) {
    return <Sidebar.Content>{children}</Sidebar.Content>;
}
