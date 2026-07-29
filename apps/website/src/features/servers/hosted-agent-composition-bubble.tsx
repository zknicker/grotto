import type { HostedAgent, HostedAgentLifecycleEvent } from '@tavern/api';
import {
    Message,
    MessageAvatar,
    MessageContent,
    MessageHeader,
} from '../../components/ui/message.tsx';
import { HostedAgentFace } from '../members/hosted-agent-face.tsx';

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
        return (
            <Message
                aria-live="polite"
                className="opacity-60"
                key={`${event.agentId}:${event.compositionId}`}
            >
                {agent ? (
                    <MessageAvatar>
                        <HostedAgentFace agent={agent} animate={false} size={32} />
                    </MessageAvatar>
                ) : null}
                <MessageContent>
                    <MessageHeader>{agent?.displayName ?? 'Agent'}</MessageHeader>
                    <p className="whitespace-pre-wrap text-foreground text-sm">{event.text}</p>
                </MessageContent>
            </Message>
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
