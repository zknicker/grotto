export function hostedServerEventIds(
    servers: Array<{ id: string }>,
    openServer: { id: string } | null | undefined
): string[] {
    return [
        ...new Set([...servers.map((server) => server.id), ...(openServer ? [openServer.id] : [])]),
    ];
}

export function hostedServerSlugFromPath(pathname: string): string | null {
    const [, root, slug] = pathname.split('/');
    return root === 's' && slug ? slug : null;
}
