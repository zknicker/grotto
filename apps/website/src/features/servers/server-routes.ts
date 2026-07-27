/** Grotto servers are addressed by their immutable slug. */
export const serversRoute = '/s';

export function serverRoute(slug: string) {
    return `${serversRoute}/${slug}`;
}

export function serverMembersRoute(slug: string) {
    return `${serverRoute(slug)}/members`;
}

export function serverComputersRoute(slug: string) {
    return `${serverRoute(slug)}/computers`;
}

export function serverConnectionsRoute(slug: string) {
    return `${serverRoute(slug)}/connections`;
}

export function serverAgentsRoute(slug: string) {
    return `${serverRoute(slug)}/agents`;
}

export function serverRemindersRoute(slug: string) {
    return `${serverRoute(slug)}/reminders`;
}

export function isServerRemindersPath(pathname: string, slug: string) {
    return pathname === serverRemindersRoute(slug);
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
