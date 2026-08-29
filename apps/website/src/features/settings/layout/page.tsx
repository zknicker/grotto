import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { appRoutes } from '../../../lib/app-routes.ts';
import { useLayoutContext } from '../../shell/use-layout-context.ts';

/**
 * Settings content column. Section navigation lives in the app sidebar rail
 * (AppSidebar renders the settings nav while a settings route is active), so
 * this layout owns only the scrolling content area.
 */
export function SettingsLayout() {
    const layoutContext = useLayoutContext();
    const location = useLocation();
    // Full-height browser surfaces own their internal scroll, so the frame
    // must pass real height through instead of page-scrolling: the global
    // Skills library, and an Agent's Workspace tab. Every other settings
    // route is a normal padded scrolling page.
    const isFullContentRoute =
        location.pathname === appRoutes.settingsSkills ||
        /\/settings\/members\/agents\/[^/]+\/workspace$/.test(location.pathname);

    return (
        <SettingsContentFrame isFullContentRoute={isFullContentRoute}>
            <Outlet context={layoutContext} />
        </SettingsContentFrame>
    );
}

export function SettingsContentFrame({
    children,
    isFullContentRoute = false,
}: {
    children: ReactNode;
    isFullContentRoute?: boolean;
}) {
    return (
        <section
            className={
                isFullContentRoute
                    ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                    : 'flex min-h-0 flex-1 flex-col overflow-y-scroll [scrollbar-gutter:stable]'
            }
        >
            <div
                className={
                    isFullContentRoute
                        ? 'h-full min-h-0 w-full flex-1'
                        : // PageColumn owns the gutter, width, and rhythm; the frame
                          // only owns scrolling.
                          'w-full'
                }
            >
                {children}
            </div>
        </section>
    );
}
