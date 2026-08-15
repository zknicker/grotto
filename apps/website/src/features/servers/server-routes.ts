/** Grotto servers are addressed by their immutable slug. */
export const serversRoute = '/s';

export function serverRoute(slug: string) {
    return `${serversRoute}/${slug}`;
}

export function serverSearchRoute(slug: string) {
    return `${serverRoute(slug)}/search`;
}

export function serverChatRoute(slug: string, chatId: string) {
    return `${serverRoute(slug)}/chats/${encodeURIComponent(chatId)}`;
}

export function serverArchivedChatsRoute(slug: string) {
    return `${serverRoute(slug)}/archived`;
}

export function tasksRoute(slug: string) {
    return `${serverRoute(slug)}/tasks`;
}

export function membersRoute(slug: string) {
    return `${serverRoute(slug)}/members`;
}

export function membersUsageRoute(
    slug: string,
    filters: { computerId?: string; runtimeId?: string } = {}
) {
    const query = new URLSearchParams();
    if (filters.computerId) {
        query.set('computer', filters.computerId);
    }
    if (filters.runtimeId) {
        query.set('runtime', filters.runtimeId);
    }
    const suffix = query.toString();
    return `${membersRoute(slug)}${suffix ? `?${suffix}` : ''}`;
}

export function agentRoute(slug: string, agentId: string, tab = 'overview') {
    return `${membersRoute(slug)}/agents/${encodeURIComponent(agentId)}/${tab}`;
}

export function humanRoute(slug: string, userId: string) {
    return `${membersRoute(slug)}/humans/${encodeURIComponent(userId)}`;
}

export function serverComputersRoute(slug: string) {
    return `${serverRoute(slug)}/computers`;
}

export function serverSettingsRoute(slug: string) {
    return `${serverRoute(slug)}/settings`;
}

export function serverSettingsSectionRoute(slug: string, section: string) {
    return `${serverSettingsRoute(slug)}/${section}`;
}

/**
 * Invitations live outside `/s/:slug` on purpose: a Server address may itself
 * be `join` or `invite`, so nesting the token under the slug branch would be
 * genuinely ambiguous.
 */
export function invitationRoute(token: string) {
    return `/invite/${token}`;
}

export function invitationLink(token: string, appOrigin = invitationAppOrigin()) {
    return new URL(invitationRoute(token), appOrigin).toString();
}

function invitationAppOrigin() {
    const configured = import.meta.env.VITE_GROTTO_APP_ORIGIN;

    if (configured) {
        return configured;
    }

    if (window.location.origin !== 'null') {
        return window.location.origin;
    }

    throw new Error(
        'VITE_GROTTO_APP_ORIGIN is required to create invitation links in the desktop App.'
    );
}
