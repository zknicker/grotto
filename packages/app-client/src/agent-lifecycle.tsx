import type { Agent, AgentLifecycleEvent } from '@tavern/api';
import * as React from 'react';
import { grottoTrpc } from './grotto-client.tsx';

export type AgentLifecycles = ReadonlyMap<string, AgentLifecycleEvent>;

const compositionLifetimeMs = 12_000;
const emptyLifecycles: AgentLifecycles = new Map();

export function useAgentLifecycleEvents(serverId: string | undefined): AgentLifecycles {
    const utils = grottoTrpc.useUtils();
    const expiryTimersRef = React.useRef(
        new Map<string, ReturnType<typeof globalThis.setTimeout>>()
    );
    const [state, setState] = React.useState<{
        events: Map<string, AgentLifecycleEvent>;
        serverId: string | undefined;
    }>({ events: new Map(), serverId });

    React.useEffect(
        () => () => {
            for (const timer of expiryTimersRef.current.values()) {
                globalThis.clearTimeout(timer);
            }
            expiryTimersRef.current.clear();
        },
        []
    );

    grottoTrpc.agent.onLifecycle.useSubscription(
        { serverId: serverId ?? '' },
        {
            enabled: serverId !== undefined,
            onData: (event) => {
                if (event.serverId !== serverId) {
                    return;
                }
                const existingTimer = expiryTimersRef.current.get(event.agentId);
                if (existingTimer) {
                    globalThis.clearTimeout(existingTimer);
                    expiryTimersRef.current.delete(event.agentId);
                }
                setState((current) => {
                    const events =
                        current.serverId === serverId
                            ? new Map(current.events)
                            : new Map<string, AgentLifecycleEvent>();
                    events.set(event.agentId, event);
                    return { events, serverId };
                });
                if (event.phase === 'sending') {
                    const timer = globalThis.setTimeout(() => {
                        setState((current) => {
                            if (
                                current.serverId !== event.serverId ||
                                current.events.get(event.agentId) !== event
                            ) {
                                return current;
                            }
                            const events = new Map(current.events);
                            events.delete(event.agentId);
                            return { ...current, events };
                        });
                        expiryTimersRef.current.delete(event.agentId);
                    }, compositionExpiryDelay(event.emittedAt));
                    expiryTimersRef.current.set(event.agentId, timer);
                }
                void utils.agent.list.cancel({ serverId: event.serverId });
                void utils.agent.get.cancel({
                    agentId: event.agentId,
                    serverId: event.serverId,
                });
                utils.agent.list.setData({ serverId: event.serverId }, (agents) =>
                    agents ? projectAgentAvailability(agents, event) : agents
                );
                utils.agent.get.setData(
                    { agentId: event.agentId, serverId: event.serverId },
                    (agent) => (agent ? projectAgentAvailability([agent], event)[0] : agent)
                );
                if (event.phase === 'settled') {
                    void Promise.all([
                        utils.agent.activity.invalidate({
                            agentId: event.agentId,
                            limit: 50,
                            serverId: event.serverId,
                        }),
                        utils.agent.deliveryState.invalidate({
                            agentId: event.agentId,
                            serverId: event.serverId,
                        }),
                        utils.agent.get.invalidate({
                            agentId: event.agentId,
                            serverId: event.serverId,
                        }),
                        utils.agent.list.invalidate({ serverId: event.serverId }),
                        utils.stats.live.invalidate({ serverId: event.serverId }),
                    ]);
                }
            },
            onStarted: () => {
                if (serverId) {
                    void Promise.all([
                        utils.agent.get.invalidate(undefined, { exact: false }),
                        utils.agent.list.invalidate({ serverId }),
                    ]);
                }
            },
        }
    );

    return state.serverId === serverId ? state.events : emptyLifecycles;
}

export function compositionExpiryDelay(emittedAt: string, now = Date.now()) {
    return Math.max(0, compositionLifetimeMs - (now - new Date(emittedAt).getTime()));
}

export function projectAgentAvailability(
    agents: readonly Agent[],
    event: AgentLifecycleEvent
): Agent[] {
    return agents.map((agent) => {
        if (agent.id !== event.agentId) {
            return agent;
        }
        const availability =
            event.phase !== 'settled'
                ? ('working' as const)
                : event.outcome === 'failed'
                  ? ('error' as const)
                  : event.outcome === 'stopped'
                    ? ('stopped' as const)
                    : ('idle' as const);
        return { ...agent, availability };
    });
}
