import { ChatMessage } from '@heroui-pro/react';
import type { HostedAgent, HostedAgentLifecycleEvent } from '@tavern/api';
import { getEntityInitials } from '../../components/ui/entity-avatar.tsx';

type SendingLifecycle = Extract<HostedAgentLifecycleEvent, { phase: 'sending' }>;

export function HostedAgentCompositionBubbles({
    agents,
    chatId,
    lifecycles,
}: {
    agents: readonly HostedAgent[];
    chatId: string | undefined;
    lifecycles: ReadonlyMap<string, HostedAgentLifecycleEvent>;
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

export function hasHostedAgentComposition(
    chatId: string | undefined,
    lifecycles: ReadonlyMap<string, HostedAgentLifecycleEvent>
) {
    return (
        chatId !== undefined &&
        [...lifecycles.values()].some(
            (event) => event.phase === 'sending' && event.chatId === chatId
        )
    );
}
