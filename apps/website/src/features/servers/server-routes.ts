/** Grotto servers are addressed by their immutable slug. */
export const serversRoute = '/s';

export function serverRoute(slug: string) {
    return `${serversRoute}/${slug}`;
}
