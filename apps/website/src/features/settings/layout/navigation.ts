import type { IconSvgElement } from '@hugeicons/react';
import {
    Activity01Icon,
    AiBrain01Icon,
    BrowserIcon,
    ChatIcon,
    ComputerTerminal01Icon,
    HourglassIcon,
    PaintBrush03Icon,
    Plug01Icon,
    SystemUpdate01Icon,
    UserCircleIcon,
    ZapIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { appRoutes } from '../../../lib/app-routes.ts';

export const staticSettingsNavItems = [
    {
        icon: ComputerTerminal01Icon,
        id: 'agent-runtime',
        label: 'Grotto Runtime',
        to: appRoutes.settingsAgentRuntime,
    },
    {
        icon: PaintBrush03Icon,
        id: 'appearance',
        label: 'Appearance',
        to: appRoutes.settingsAppearance,
    },
    {
        icon: UserCircleIcon,
        id: 'profile',
        label: 'Profile',
        to: appRoutes.settingsProfile,
    },
    {
        icon: SystemUpdate01Icon,
        id: 'updates',
        label: 'Updates',
        to: appRoutes.settingsUpdates,
    },
    {
        icon: Activity01Icon,
        id: 'stats',
        label: 'Stats',
        to: appRoutes.settingsStats,
    },
    {
        icon: ChatIcon,
        id: 'sessions',
        label: 'Sessions',
        to: appRoutes.settingsSessions,
    },
    {
        icon: AiBrain01Icon,
        id: 'models',
        label: 'Models',
        to: appRoutes.settingsModels,
    },
    {
        icon: ZapIcon,
        id: 'skills',
        label: 'Skills',
        to: appRoutes.settingsSkills,
    },
    {
        icon: Plug01Icon,
        id: 'connections',
        label: 'Connections',
        to: appRoutes.settingsConnections,
    },
    {
        icon: BrowserIcon,
        id: 'browser',
        label: 'Browser',
        to: appRoutes.settingsBrowser,
    },
    {
        icon: HourglassIcon,
        id: 'jobs',
        label: 'Jobs',
        to: appRoutes.settingsJobs,
    },
] as const satisfies ReadonlyArray<{
    icon: IconSvgElement;
    id: string;
    label: string;
    to: string;
}>;

export const settingsNavItems = staticSettingsNavItems;

export const settingsNavSections = [
    {
        id: 'general',
        itemIds: [
            'agent-runtime',
            'appearance',
            'profile',
            'updates',
            'models',
            'skills',
            'connections',
            'browser',
        ],
        label: 'General',
    },
    {
        id: 'activity',
        itemIds: ['sessions', 'jobs', 'stats'],
        label: 'Activity',
    },
] as const;

export type SettingsNavItem = (typeof settingsNavItems)[number];
export type SettingsRouteTab = SettingsNavItem['id'];
