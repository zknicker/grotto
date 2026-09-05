import { Chip } from '@heroui/react';
import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useRelativeNow } from '../../../components/time/relative-time.tsx';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { formatRelativeTime } from '../../../lib/format.ts';
import { cn } from '../../../lib/utils.ts';
import type { TranscriptActor } from '../chat-transcript-model.ts';
import {
    getTranscriptMessageThread,
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chat-transcript-render-context.tsx';
import { messagePreviewLine } from '../message-preview-line.ts';

/**
 * A Thread as it reads from its anchor: a reply count and the last few
 * replies with their faces, so the conversation is legible without opening
 * the panel. A Thread with no replies shows nothing at all — a task says what
 * it is with its header mark, so an empty card would only add noise.
 */
export function ThreadPreviewBlock({ row }: { row: TranscriptMessageRow }) {
    const context = useTranscriptRenderContextOptional();
    const now = useRelativeNow();
    const thread = getTranscriptMessageThread(row);

    if (!(context && thread) || thread.replyCount === 0) {
        return null;
    }

    const replies = thread.recentReplies ?? [];
    const label = replyLabel(thread.replyCount);

    return (
        <div className="group/thread card-shell relative mt-1.5 flex w-full min-w-0 flex-col gap-1 bg-nested-surface px-2.5 py-2 shadow-(--nested-surface-ring) hover:bg-nested-surface-hover">
            <button
                aria-label={`Open thread, ${label}`}
                className="card-shell absolute inset-0 cursor-[var(--cursor-interactive)] outline-none focus-visible:ring-2 focus-visible:ring-focus"
                onClick={() => context.onOpenThread(row)}
                type="button"
            />
            <div className="pointer-events-none relative flex min-w-0 items-center justify-end gap-2 text-xs">
                <span className="flex shrink-0 items-center gap-1 font-semibold text-muted text-xs group-hover/thread:text-foreground">
                    {label}
                    {thread.unreadCount > 0 ? (
                        <>
                            <span aria-hidden>·</span>
                            <span className="text-accent">{thread.unreadCount} new</span>
                        </>
                    ) : null}
                    <Icon aria-hidden className="size-3" icon={ArrowRight01Icon} />
                </span>
            </div>
            {replies.length > 0 ? (
                <div className="pointer-events-none relative flex w-full min-w-0 flex-col gap-1 text-left">
                    {replies.map((reply) => (
                        <ThreadPreviewReply
                            key={reply.id}
                            now={now}
                            reply={reply}
                            resolveActorProfile={context.resolveActorProfile}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

type ThreadReplyPreview = NonNullable<
    ReturnType<typeof getTranscriptMessageThread>
>['recentReplies'];

function ThreadPreviewReply({
    now,
    reply,
    resolveActorProfile,
}: {
    now: number;
    reply: NonNullable<ThreadReplyPreview>[number];
    resolveActorProfile?: (
        actor: TranscriptActor
    ) => { avatarUrl: null | string; deleted: boolean; name: string } | null;
}) {
    const actor: TranscriptActor = reply.authorAgentId
        ? { id: reply.authorAgentId, kind: 'agent' }
        : reply.authorUserId
          ? { id: reply.authorUserId, kind: 'participant' }
          : null;
    const profile = actor ? resolveActorProfile?.(actor) : null;
    const name = threadPreviewAuthorName(profile);

    return (
        <span className="flex min-w-0 items-center gap-1.5 text-sm leading-tight">
            <span className={cn(profile?.deleted && 'opacity-50 grayscale')}>
                <EntityAvatar name={name} size={20} src={profile?.avatarUrl} />
            </span>
            <span
                className={cn(
                    'shrink-0 font-semibold',
                    profile?.deleted ? 'text-muted' : 'text-foreground'
                )}
            >
                {name}
            </span>
            {profile?.deleted ? (
                <Chip size="sm" variant="secondary">
                    DELETED
                </Chip>
            ) : null}
            <span className="min-w-0 flex-1 truncate text-muted">
                {messagePreviewLine(reply.content)}
            </span>
            <span className={cn('shrink-0 text-muted text-xs tabular-nums')}>
                {formatRelativeTime(reply.createdAt, now)}
            </span>
        </span>
    );
}

export function threadPreviewAuthorName(profile: { name: string } | null | undefined) {
    return profile?.name ?? 'Unknown';
}

function replyLabel(replyCount: number) {
    return `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
}
