import type { IconSvgElement } from '@hugeicons/react';
import {
    AiBrain01Icon,
    BrowserIcon,
    Plug01Icon,
    PreferenceHorizontalIcon,
    ServerStack01Icon,
    UserCircleIcon,
    UserMultipleIcon,
    ZapIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { appRoutes } from '../../../lib/app-routes.ts';

/**
 * Settings splits on who a setting belongs to, not on what feature it came
 * from. Three groups, in order of how close the subject is to the reader:
 *
 *   Account — you, and this device.
 *   Server  — this Server and who is in it.
 *   Agents  — what the Agents on it can reach.
 *
 * One flat "General" list mixed all three: Appearance (a device preference)
 * sat between Server (administration) and Profile (identity), and the four
 * pages that are really one subject — what an Agent can do — were scattered
 * through it.
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
        label: 'General',
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

/**
 * Computers is its own section because its rows come from the roster rather
 * than from this list; the sidebar renders it after these.
 */
export const settingsNavSections = [
    {
        id: 'account',
        itemIds: ['profile', 'preferences'],
        label: 'Account',
    },
    {
        id: 'server',
        itemIds: ['server', 'members'],
        label: 'Server',
    },
    {
        id: 'agents',
        itemIds: ['connections', 'models', 'skills', 'browser'],
        label: 'Agents',
    },
] as const;

export type SettingsNavItem = (typeof settingsNavItems)[number];
/** Static section ids plus the dynamic Computers section (rows come from the roster). */
export type SettingsRouteTab = SettingsNavItem['id'] | 'computers';
