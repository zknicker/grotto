/** Grotto servers are addressed by their immutable slug. */
export const serversRoute = '/s';

export function serverRoute(slug: string) {
    return `${serversRoute}/${slug}`;
}

export function serverMembersRoute(slug: string) {
    return `${serverRoute(slug)}/members`;
}

/**
 * Invitations live outside `/s/:slug` on purpose: a Server address may itself
 * be `join` or `invite`, so nesting the token under the slug branch would be
 * genuinely ambiguous.
 */
export function invitationRoute(token: string) {
    return `/invite/${token}`;
}

export function invitationLink(token: string) {
    return new URL(invitationRoute(token), window.location.origin).toString();
}
