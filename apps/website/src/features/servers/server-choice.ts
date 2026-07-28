import type { ServerSummary } from '../../lib/grotto-server.tsx';

export const lastServerSlugStorageKey = 'grotto.last-server-slug';

export function resolveEntryServer(
    servers: ServerSummary[],
    lastServerSlug: string | null
): ServerSummary | null {
    if (servers.length === 0) {
        return null;
    }

    return servers.find((server) => server.slug === lastServerSlug) ?? servers[0] ?? null;
}

export function readLastServerSlug(storage: Pick<Storage, 'getItem'> = window.localStorage) {
    return storage.getItem(lastServerSlugStorageKey);
}

export function rememberLastServerSlug(
    slug: string,
    storage: Pick<Storage, 'setItem'> = window.localStorage
) {
    storage.setItem(lastServerSlugStorageKey, slug);
}

export function parseInvitationToken(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    try {
        const url = new URL(trimmed);
        return tokenFromPath(url.pathname);
    } catch {
        return tokenFromPath(trimmed) ?? trimmed;
    }
}

function tokenFromPath(value: string) {
    const match = value.match(/(?:^|\/)invite\/([^/?#]+)/u);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
}
