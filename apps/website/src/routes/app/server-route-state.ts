import type { Chat } from '@tavern/api';
import { resolveEntryChat } from '../../features/servers/server-choice.ts';
import {
    serverChatRoute,
    serverRoute,
    serverSettingsRoute,
} from '../../features/servers/server-routes.ts';
import type { SettingsRouteTab } from '../../features/settings/layout/navigation.ts';
import type { AppRailSection } from '../../features/shell/app-rail.tsx';

export function resolveSidebarPage(active: AppRailSection, canOperate: boolean) {
    if (active === 'settings' || active === 'tasks' || active === 'members') {
        return active;
    }
    if (active === 'computers' && canOperate) {
        return active;
    }
    return 'server';
}

export function shouldShowSidebar(active: AppRailSection, canOperate: boolean) {
    if (active === 'search') {
        return false;
    }
    return active !== 'computers' || canOperate;
}

export function resolveChatSectionRoute(chats: Chat[], lastChatId: string | null, slug: string) {
    const chat = resolveEntryChat(chats, lastChatId);
    return chat ? serverChatRoute(slug, chat.id) : serverRoute(slug);
}

export function resolveActiveSection(pathname: string, slug: string): AppRailSection {
    const suffix = pathname.slice(serverRoute(slug).length);
    if (suffix.startsWith('/members')) {
        return 'members';
    }
    if (suffix.startsWith('/computers')) {
        return 'computers';
    }
    if (suffix.startsWith('/settings')) {
        return 'settings';
    }
    if (suffix.startsWith('/tasks')) {
        return 'tasks';
    }
    if (suffix.startsWith('/search')) {
        return 'search';
    }
    return 'chat';
}

export function resolveSelectedChatId(pathname: string, slug: string) {
    const prefix = `${serverRoute(slug)}/chats/`;
    return pathname.startsWith(prefix)
        ? decodeURIComponent(pathname.slice(prefix.length))
        : undefined;
}

export function resolveSettingsSection(
    pathname: string,
    slug: string
): SettingsRouteTab | undefined {
    const prefix = `${serverSettingsRoute(slug)}/`;
    if (!pathname.startsWith(prefix)) {
        return undefined;
    }
    const section = decodeURIComponent(pathname.slice(prefix.length)).split('/')[0];
    return section ? (section as SettingsRouteTab) : undefined;
}
