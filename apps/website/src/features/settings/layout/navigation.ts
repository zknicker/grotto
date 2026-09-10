import type { IconSvgElement } from '@hugeicons/react';
import {
    AiBrain01Icon,
    Plug01Icon,
    PreferenceHorizontalIcon,
    ServerStack01Icon,
    UserCircleIcon,
    UserMultipleIcon,
    ZapIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { appRoutes } from '../../../lib/app-routes.ts';

/**
 * Personal settings affect the reader; Server settings describe shared
 * membership and capabilities. Machine-specific controls live on each Computer.
 */
export const staticSettingsNavItems = [
    {
        icon: UserCircleIcon,
        id: 'profile',
        label: 'Profile',
        to: appRoutes.settingsProfile,
    },
    {
        icon: PreferenceHorizontalIcon,
        id: 'preferences',
        label: 'Preferences',
        to: appRoutes.settingsPreferences,
    },
    {
        icon: ServerStack01Icon,
        id: 'server',
        label: 'Server',
        to: appRoutes.settings,
    },
    {
        icon: UserMultipleIcon,
        id: 'members',
        label: 'Members',
        to: appRoutes.settingsMembers,
    },
    {
        icon: Plug01Icon,
        id: 'connections',
        label: 'Connections',
        to: appRoutes.settingsConnections,
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
] as const satisfies ReadonlyArray<{
    icon: IconSvgElement;
    id: string;
    label: string;
    to: string;
}>;

export const settingsNavItems = staticSettingsNavItems;

/**
 * Computers is its own section because its rows come from the roster rather
 * than from this list; the sidebar renders it after these.
 */
export const settingsNavSections = [
    {
        id: 'personal',
        itemIds: ['profile', 'preferences'],
        label: 'Preferences',
    },
    {
        id: 'server',
        itemIds: ['server', 'members', 'connections', 'models', 'skills'],
        label: 'Server',
    },
] as const;

export type SettingsNavItem = (typeof settingsNavItems)[number];
/** Static section ids plus the dynamic Computers section (rows come from the roster). */
export type SettingsRouteTab = SettingsNavItem['id'] | 'computers';
