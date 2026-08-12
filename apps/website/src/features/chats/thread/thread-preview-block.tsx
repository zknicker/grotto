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

/**
 * A Thread as it reads from its anchor: a reply count and the last few
 * replies with their faces, so the conversation is legible without opening
 * the panel. A Thread with no replies shows nothing — the anchor's hover
 * actions already carry "Reply in thread".
 */
export function ThreadPreviewBlock({ row }: { row: TranscriptMessageRow }) {
    const context = useTranscriptRenderContextOptional();
    const now = useRelativeNow();
    const thread = getTranscriptMessageThread(row);

    if (!(context && thread) || thread.replyCount === 0) {
        return null;
    }

    const replies = thread.recentReplies ?? [];

    return (
        <button
            className="group/thread mt-1.5 flex w-full min-w-0 cursor-[var(--cursor-interactive)] flex-col gap-1 rounded-lg bg-surface-secondary px-2.5 py-2 text-left outline-none transition-colors hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus"
            onClick={() => context.onOpenThread(row)}
            type="button"
        >
            <span className="flex shrink-0 items-center gap-1 font-semibold text-muted text-xs group-hover/thread:text-foreground">
                {replyLabel(thread.replyCount)}
                {thread.unreadCount > 0 ? (
                    <>
                        <span aria-hidden>·</span>
                        <span className="text-accent">{thread.unreadCount} new</span>
                    </>
                ) : null}
                <Icon aria-hidden className="size-3" icon={ArrowRight01Icon} />
            </span>
            {replies.map((reply) => (
                <ThreadPreviewReply
                    key={reply.id}
                    now={now}
                    reply={reply}
                    resolveActorProfile={context.resolveActorProfile}
                />
            ))}
        </button>
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
        <span className="flex min-w-0 items-center gap-1.5 text-xs leading-tight">
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
            <span className="min-w-0 flex-1 truncate text-muted">{oneLine(reply.content)}</span>
            <span className={cn('shrink-0 text-muted tabular-nums')}>
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

/** Preview rows are one line; newlines and code fences would break the rhythm. */
function oneLine(content: string) {
    return content.replace(/\s+/gu, ' ').trim();
}
