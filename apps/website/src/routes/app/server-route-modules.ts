import type { AppRailSection } from '../../features/shell/app-rail.tsx';

export function cachedRouteModule<TModule>(load: () => Promise<TModule>) {
    let pending: Promise<TModule> | undefined;

    return () => {
        pending ??= load().catch((error: unknown) => {
            pending = undefined;
            throw error;
        });
        return pending;
    };
}

export const serverRouteModules = {
    activity: cachedRouteModule(() => import('./server-activity-page.tsx')),
    brief: cachedRouteModule(() => import('./server-brief-variations-page.tsx')),
    chat: cachedRouteModule(() => import('./server-chat-page.tsx')),
    computers: cachedRouteModule(() => import('./server-computers-page.tsx')),
    default: cachedRouteModule(() => import('./server-default-page.tsx')),
    members: cachedRouteModule(() => import('./server-members-page.tsx')),
    reminders: cachedRouteModule(() => import('./server-reminders-page.tsx')),
    search: cachedRouteModule(() => import('./server-search-page.tsx')),
    settings: cachedRouteModule(() => import('./server-settings-page.tsx')),
    settingsSection: cachedRouteModule(() => import('./server-settings-section-page.tsx')),
    tasks: cachedRouteModule(() => import('./server-tasks-page.tsx')),
};

const routeModulesBySection: Record<
    AppRailSection,
    ReadonlyArray<() => Promise<Record<string, unknown>>>
> = {
    activity: [serverRouteModules.activity],
    chat: [serverRouteModules.chat],
    computers: [serverRouteModules.computers],
    members: [serverRouteModules.members],
    reminders: [serverRouteModules.reminders],
    search: [serverRouteModules.search],
    settings: [serverRouteModules.settings, serverRouteModules.settingsSection],
    tasks: [serverRouteModules.tasks],
};

/** Best-effort route warming. A failed preload is retried by the real navigation. */
export function preloadServerSection(section: AppRailSection) {
    for (const load of routeModulesBySection[section]) {
        load().catch(() => undefined);
    }
}

/** Warm the persistent shell's primary destinations once the browser is idle. */
export function preloadServerRoutes() {
    for (const section of Object.keys(routeModulesBySection) as AppRailSection[]) {
        preloadServerSection(section);
    }
}
