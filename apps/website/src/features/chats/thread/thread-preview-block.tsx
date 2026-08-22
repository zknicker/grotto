import { Chip } from '@heroui/react';
import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
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
 * the panel. A plain Thread with no replies shows nothing; a task keeps the
 * same work-surface header even before its first reply.
 */
export function ThreadPreviewBlock({
    headerLeading,
    isHeaderLeadingInteractive = false,
    row,
}: {
    headerLeading?: React.ReactNode;
    isHeaderLeadingInteractive?: boolean;
    row: TranscriptMessageRow;
}) {
    const context = useTranscriptRenderContextOptional();
    const now = useRelativeNow();
    const thread = getTranscriptMessageThread(row);

    if (!context || (!headerLeading && (!thread || thread.replyCount === 0))) {
        return null;
    }

    const replies = thread?.recentReplies ?? [];
    const replyCount = thread?.replyCount ?? 0;
    const label = replyLabel(replyCount);

    return (
        <div className="group/thread relative mt-1.5 flex w-full min-w-0 flex-col gap-1 rounded-lg bg-nested-surface px-2.5 py-2 hover:bg-nested-surface-hover">
            <button
                aria-label={replyCount > 0 ? `Open thread, ${label}` : 'Open task thread'}
                className="absolute inset-0 cursor-[var(--cursor-interactive)] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus"
                onClick={() => context.onOpenThread(row)}
                type="button"
            />
            <div className="pointer-events-none relative flex min-w-0 items-center justify-between gap-2 text-xs">
                {headerLeading ? (
                    <div
                        className={cn(
                            'relative z-10 min-w-0',
                            isHeaderLeadingInteractive && 'pointer-events-auto'
                        )}
                    >
                        {headerLeading}
                    </div>
                ) : null}
                <span className="flex shrink-0 items-center gap-1 font-semibold text-muted text-xs group-hover/thread:text-foreground">
                    {label}
                    {(thread?.unreadCount ?? 0) > 0 ? (
                        <>
                            <span aria-hidden>·</span>
                            <span className="text-accent">{thread?.unreadCount} new</span>
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
            <span className="min-w-0 flex-1 truncate text-muted">{oneLine(reply.content)}</span>
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

/** Preview rows are one line; newlines and code fences would break the rhythm. */
function oneLine(content: string) {
    return content.replace(/\s+/gu, ' ').trim();
}
