import { ChatMessage } from '@heroui-pro/react';
import * as React from 'react';
import { getEntityInitials } from '../../components/ui/entity-avatar.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import type { ChatComposition } from '../../hooks/chats/use-chat-compositions.ts';
import { useChatCompositions } from '../../hooks/chats/use-chat-compositions.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { resolveChatCompositionTarget } from './chat-composition-target.ts';
import { buildChatList } from './chat-list-data.ts';

type Agent = AgentListOutput['agents'][number];

/**
 * Provisional agent bubbles for in-flight `grotto message send`s scoped to
 * this chat (specs/chat-timeline.md). Ephemeral and app-local — never
 * written into a durable chat cache. `messageCompositionIds` are the
 * compositionId stamps already seen on durable messages in this render;
 * a match commits (removes) the provisional bubble in favor of the real one.
 */
export function ChatCompositionBubbles({
    chatId,
    compositionTarget,
    messageCompositionIds,
}: {
    chatId: string;
    compositionTarget?: string | null;
    messageCompositionIds: ReadonlySet<string>;
}) {
    if (compositionTarget !== undefined) {
        return (
            <TargetedChatCompositionBubbles
                messageCompositionIds={messageCompositionIds}
                target={compositionTarget}
            />
        );
    }

    return (
        <ChatListCompositionBubbles chatId={chatId} messageCompositionIds={messageCompositionIds} />
    );
}

function ChatListCompositionBubbles({
    chatId,
    messageCompositionIds,
}: {
    chatId: string;
    messageCompositionIds: ReadonlySet<string>;
}) {
    const chats = buildChatList(useChatList().data);
    const chat = chats.find((entry) => entry.id === chatId) ?? null;
    const target = chat ? resolveChatCompositionTarget(chat) : null;

    return (
        <TargetedChatCompositionBubbles
            messageCompositionIds={messageCompositionIds}
            target={target}
        />
    );
}

function TargetedChatCompositionBubbles({
    messageCompositionIds,
    target,
}: {
    messageCompositionIds: ReadonlySet<string>;
    target: string | null;
}) {
    const { compositions, dropComposition } = useChatCompositions();
    const agents = useAgentList().data?.agents ?? [];

    React.useEffect(() => {
        for (const compositionId of messageCompositionIds) {
            dropComposition(compositionId);
        }
    }, [messageCompositionIds, dropComposition]);

    if (!target) {
        return null;
    }

    const visible = [...compositions].filter(
        ([compositionId, composition]) =>
            composition.target === target &&
            composition.text.trim().length > 0 &&
            !messageCompositionIds.has(compositionId)
    );

    if (visible.length === 0) {
        return null;
    }

    return (
        <>
            {visible.map(([compositionId, composition]) => (
                <CompositionBubble
                    agent={agents.find((entry) => entry.id === composition.agentId) ?? null}
                    composition={composition}
                    key={compositionId}
                />
            ))}
        </>
    );
}

function CompositionBubble({
    agent,
    composition,
}: {
    agent: Agent | null;
    composition: ChatComposition;
}) {
    const displayName = agent?.name ?? 'Agent';

    return (
        <ChatMessage.Assistant aria-live="polite" className="opacity-60">
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
                    <p className="whitespace-pre-wrap">{composition.text}</p>
                </ChatMessage.Content>
            </ChatMessage.Body>
        </ChatMessage.Assistant>
    );
}
