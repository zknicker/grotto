import { useLocation } from 'react-router-dom';
import { useServer } from '../../hooks/servers/use-server.ts';
import { useServerEvents } from '../../hooks/servers/use-server-events.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';
import { hostedServerEventIds, hostedServerSlugFromPath } from './hosted-server-event-model.ts';

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
