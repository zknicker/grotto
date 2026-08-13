import { useLocation } from 'react-router-dom';
import { useServer } from '../../hooks/servers/use-server.ts';
import { useServerEvents } from '../../hooks/servers/use-server-events.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';
import {
    type ServerEventTarget,
    serverEventTargets,
    serverSlugFromPath,
} from './server-event-model.ts';

/**
 * Keeps membership-loss listening alive across every Server route. The current
 * route contributes its Server before the list resolves; list state covers `/s`
 * and every other membership. One child owns one deduplicated subscription.
 */
export function ServerEventListeners() {
    const location = useLocation();
    const servers = useServerList();
    const openSlug = serverSlugFromPath(location.pathname);
    const openServer = useServer(openSlug ?? '', openSlug !== null);
    const targets = serverEventTargets(servers.data ?? [], openServer.data);

    return (
        <>
            {targets.map((target) => (
                <ServerEventListener key={target.id} target={target} />
            ))}
        </>
    );
}

function ServerEventListener({ target }: { target: ServerEventTarget }) {
    useServerEvents(target.id, target.slug);
    return null;
}
