import { ChatMessage } from '@heroui-pro/react';
import type { Agent, AgentLifecycleEvent } from '@tavern/api';
import { getEntityInitials } from '../../../components/ui/entity-avatar.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useAgentLifecycle } from '../agent-lifecycle.tsx';

type SendingLifecycle = Extract<AgentLifecycleEvent, { phase: 'sending' }>;

export function ChatAgentComposition({
    chatId,
    serverId,
}: {
    chatId: string | undefined;
    serverId: string;
}) {
    const agents = useAgents(serverId);
    const lifecycles = useAgentLifecycle();

    return (
        <AgentCompositionBubbles
            agents={agents.data ?? []}
            chatId={chatId}
            lifecycles={lifecycles}
        />
    );
}

export function AgentCompositionBubbles({
    agents,
    chatId,
    lifecycles,
}: {
    agents: readonly Agent[];
    chatId: string | undefined;
    lifecycles: ReadonlyMap<string, AgentLifecycleEvent>;
}) {
    if (!chatId) {
        return null;
    }
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const sending = [...lifecycles.values()].filter(
        (event): event is SendingLifecycle => event.phase === 'sending' && event.chatId === chatId
    );

    return sending.map((event) => {
        const agent = agentsById.get(event.agentId);
        const displayName = agent?.displayName ?? 'Agent';
        return (
            <ChatMessage.Assistant
                aria-live="polite"
                className="opacity-60"
                key={`${event.agentId}:${event.compositionId}`}
            >
                <ChatMessage.Avatar
                    alt={`${displayName} avatar`}
                    fallback={getEntityInitials(displayName)}
                    src={agent?.avatarUrl ?? undefined}
                />
                <ChatMessage.Body>
                    <span className="font-semibold text-foreground text-sm leading-5">
                        {displayName}
                    </span>
                    <ChatMessage.Content>
                        <p className="whitespace-pre-wrap">{event.text}</p>
                    </ChatMessage.Content>
                </ChatMessage.Body>
            </ChatMessage.Assistant>
        );
    });
}

export function hasAgentComposition(
    chatId: string | undefined,
    lifecycles: ReadonlyMap<string, AgentLifecycleEvent>
) {
    return (
        chatId !== undefined &&
        [...lifecycles.values()].some(
            (event) => event.phase === 'sending' && event.chatId === chatId
        )
    );
}
