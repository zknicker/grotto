import type { IconSvgElement } from '@hugeicons/react';
import {
    AiBrain01Icon,
    BrowserIcon,
    PaintBrush03Icon,
    Plug01Icon,
    ServerStack01Icon,
    SystemUpdate01Icon,
    UserCircleIcon,
    ZapIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { appRoutes } from '../../../lib/app-routes.ts';

export const staticSettingsNavItems = [
    {
        icon: ServerStack01Icon,
        id: 'server',
        label: 'Server',
        to: appRoutes.settings,
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
            'server',
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
] as const;

export type SettingsNavItem = (typeof settingsNavItems)[number];
export type SettingsRouteTab = SettingsNavItem['id'];
