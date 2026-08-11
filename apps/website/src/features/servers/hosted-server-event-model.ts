/** One Server this session listens to, named by both ids its caches are keyed on. */
export interface HostedServerEventTarget {
    id: string;
    slug: string;
}

/**
 * The Servers to observe, deduplicated by id. Each target carries its slug so
 * the listener can invalidate that Server's detail read exactly instead of
 * every cached slug.
 */
export function hostedServerEventTargets(
    servers: readonly HostedServerEventTarget[],
    openServer: HostedServerEventTarget | null | undefined
): HostedServerEventTarget[] {
    const targets = new Map<string, HostedServerEventTarget>();

    for (const server of [...servers, ...(openServer ? [openServer] : [])]) {
        targets.set(server.id, { id: server.id, slug: server.slug });
    }

    return [...targets.values()];
}

export function hostedServerSlugFromPath(pathname: string): string | null {
    const [, root, slug] = pathname.split('/');
    return root === 's' && slug ? slug : null;
}
