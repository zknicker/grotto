import type { Agent } from '@grotto/api';
import * as React from 'react';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { AgentUsageTile } from '../../usage/agent-usage-tile.tsx';
import { AgentChats } from './agent-chats.tsx';
import { AgentGlance } from './agent-glance.tsx';
import { AgentRecentActivity } from './agent-recent-activity.tsx';

/**
 * What the Agent is doing and where to go next: the glance tiles, its token
 * volume, its newest turns, then the Chats it belongs to.
 *
 * Execution configuration, identity facts, Skills, and Connections moved to
 * Setup, and the lifecycle verbs moved into the header's menu — this tab reads
 * rather than configures.
 */
export function AgentOverview({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const chatsRef = React.useRef<HTMLDivElement>(null);

    return (
        <>
            <AgentGlance
                agent={agent}
                onOpenChats={() =>
                    chatsRef.current?.scrollIntoView({
                        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                        block: 'start',
                    })
                }
                server={server}
            />
            <AgentUsageTile agent={agent} server={server} />
            <AgentRecentActivity agent={agent} server={server} />
            <div ref={chatsRef}>
                <AgentChats agent={agent} server={server} />
            </div>
        </>
    );
}

function prefersReducedMotion() {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
