import { useServerEvents } from '../../hooks/servers/use-server-events.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';

/**
 * Keeps membership-loss listening alive across every hosted route, including
 * `/s`. One child owns one Server subscription so list changes mount and unmount
 * listeners without putting hooks in a loop.
 */
export function HostedServerEventListeners() {
    const servers = useServerList();

    return (
        <>
            {servers.data?.map((server) => (
                <HostedServerEventListener key={server.id} serverId={server.id} />
            ))}
        </>
    );
}

function HostedServerEventListener({ serverId }: { serverId: string }) {
    useServerEvents(serverId);
    return null;
}
