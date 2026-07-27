import { useLocation } from 'react-router-dom';
import { useServer } from '../../hooks/servers/use-server.ts';
import { useServerEvents } from '../../hooks/servers/use-server-events.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';

/**
 * Keeps membership-loss listening alive across every hosted route. The current
 * route contributes its Server before the list resolves; list state covers `/s`
 * and every other membership. One child owns one deduplicated subscription.
 */
export function HostedServerEventListeners() {
    const location = useLocation();
    const servers = useServerList();
    const openSlug = hostedServerSlugFromPath(location.pathname);
    const openServer = useServer(openSlug ?? '', openSlug !== null);
    const serverIds = hostedServerEventIds(servers.data ?? [], openServer.data);

    return (
        <>
            {serverIds.map((serverId) => (
                <HostedServerEventListener key={serverId} serverId={serverId} />
            ))}
        </>
    );
}

function HostedServerEventListener({ serverId }: { serverId: string }) {
    useServerEvents(serverId);
    return null;
}

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
