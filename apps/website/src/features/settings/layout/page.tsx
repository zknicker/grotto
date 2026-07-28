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
    // Only the global Skills page is the full-bleed library browser. The
    // agent Skills tab is a normal padded settings page (enablement toggles).
    const isFullContentRoute = location.pathname === appRoutes.settingsSkills;

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
                        : 'mx-auto w-full max-w-5xl px-12 pt-12 pb-16'
                }
            >
                {children}
            </div>
        </section>
    );
}
