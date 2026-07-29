import { Link } from 'react-router-dom';
import { ChatTitle } from '../../components/chats/chat-title.tsx';
import { ChatTypeBadge } from '../../components/chats/chat-type-badge.tsx';
import { Skeleton } from '../../components/ui/skeleton.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { useActorProfile } from '../../hooks/actors/use-actor.ts';
import { useChatTimeline } from '../../hooks/chats/use-chat-timeline.ts';
import { cn } from '../../lib/utils.ts';
import { getActorNameClassName, getActorNameStyle } from '../rows/actor-color.ts';
import { type AgentChatPreviewLine, buildAgentChatPreview } from './agent-chat-preview.ts';
import { getChatCardDomId } from './chat-card-dom-id.ts';
import { type ChatListItem, getChatLastActivityLabel } from './chat-list-data.ts';
import { buildChatPath } from './chat-path.ts';

export function AgentChatCard({
    chat,
    highlighted,
    hasActiveReply,
}: {
    chat: ChatListItem;
    highlighted: boolean;
    hasActiveReply: boolean;
}) {
    const isTavernChat = chat.framework === 'tavern';
    const className = cn(
        'group flex aspect-square flex-col rounded-xl border border-border bg-card',
        isTavernChat
            ? 'hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            : null,
        hasActiveReply ? 'ring-1 ring-info' : null,
        highlighted ? 'border-brand ring-1 ring-brand' : null
    );
    const content = (
        <>
            <div className="flex items-baseline justify-between gap-2 px-4 pt-3.5 pb-1">
                <h2
                    className="min-w-0 truncate font-semibold text-foreground text-sm"
                    title={chat.title}
                >
                    <ChatTitle chat={chat} />
                </h2>
                <span className="flex shrink-0 items-center gap-1.5">
                    <ChatTypeBadge chat={chat} showDetail={false} />
                    {hasActiveReply ? <StatusDot pulse status="success" /> : null}
                </span>
            </div>
            <p
                className="truncate px-4 text-meta text-muted-foreground"
                title={chat.latestSession?.sessionKey ?? chat.displayName}
            >
                {chat.latestSession?.sessionKey ?? chat.displayName}{' '}
                {getChatLastActivityLabel(chat)}
            </p>

            <div className="flex min-h-0 flex-1 flex-col justify-end px-4 pt-3 pb-3.5">
                {isTavernChat ? (
                    <TavernChatPreview chatId={chat.id} />
                ) : (
                    <AgentChatPreview chat={chat} />
                )}
            </div>
        </>
    );

    return isTavernChat ? (
        <Link className={className} id={getChatCardDomId(chat.id)} to={buildChatPath(chat.id)}>
            {content}
        </Link>
    ) : (
        <div className={className} id={getChatCardDomId(chat.id)}>
            {content}
        </div>
    );
}

function TavernChatPreview({ chatId }: { chatId: string }) {
    const timeline = useChatTimeline({
        chatId,
        limit: 8,
    });
    const previewLines = buildAgentChatPreview(timeline.rows);

    if (timeline.isPending) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-3.5 w-28 rounded-full" />
                <Skeleton className="h-3.5 w-full rounded-full" />
                <Skeleton className="h-3.5 w-4/5 rounded-full" />
            </div>
        );
    }

    if (previewLines.length > 0) {
        return (
            <div className="space-y-1">
                {previewLines.map((line) => (
                    <AgentChatPreviewRow key={line.id} line={line} />
                ))}
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-border border-dashed px-3 py-3 text-meta text-muted-foreground">
            No synced messages yet.
        </div>
    );
}

function AgentChatPreview({ chat }: { chat: ChatListItem }) {
    const sessionLabel =
        chat.sessionCount === 1
            ? '1 contributing session'
            : `${chat.sessionCount} contributing sessions`;

    return (
        <div className="rounded-lg border border-border border-dashed px-3 py-3 text-meta text-muted-foreground">
            <p className="font-medium text-foreground">{chat.source.label}</p>
            <p className="mt-1">{sessionLabel}</p>
            <p className="mt-1">Read-only runtime chat reference.</p>
        </div>
    );
}

function AgentChatPreviewRow({ line }: { line: AgentChatPreviewLine }) {
    const actorProfile = useActorProfile(line.actor);
    const sender = actorProfile?.name ?? line.sender;

    return (
        <p className="flex items-baseline gap-2 text-meta leading-snug" title={line.content}>
            <span className="shrink-0 text-muted-foreground">{line.timeLabel}</span>
            <span
                className={cn(
                    'shrink-0 font-medium',
                    line.senderType === 'agent'
                        ? 'text-foreground'
                        : line.senderType === 'user'
                          ? getActorNameClassName({
                                actor: actorProfile,
                                fallbackName: sender,
                            })
                          : 'text-muted-foreground'
                )}
                style={line.senderType === 'user' ? getActorNameStyle(actorProfile) : undefined}
            >
                {sender}
            </span>
            <span className="min-w-0 truncate text-muted-foreground">{line.content}</span>
        </p>
    );
}
