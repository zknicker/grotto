import { useAgentLifecycleEvents, useServerList } from '@tavern/app-client';
import type { ReactNode } from 'react';
import { ChatEventListeners } from './chat-events.tsx';

export function ServerEventBoundary({ children }: { children: ReactNode }) {
    const serverId = useServerList().data?.[0]?.id;

    return (
        <>
            {serverId ? <ChatEventListeners key={`chat:${serverId}`} serverId={serverId} /> : null}
            {serverId ? (
                <AgentLifecycleListener key={`agent:${serverId}`} serverId={serverId} />
            ) : null}
            {children}
        </>
    );
}

function AgentLifecycleListener({ serverId }: { serverId: string }) {
    useAgentLifecycleEvents(serverId);
    return null;
}
