import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import { useRelativeNow } from '../../../components/time/relative-time.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { formatRelativeTime } from '../../../lib/format.ts';
import { cn } from '../../../lib/utils.ts';

export interface ThreadReplySummary {
    latestReplyAt: string | null;
    replyCount: number;
    unreadCount: number;
}

export function getThreadReplyPillText(summary: ThreadReplySummary, now = Date.now()) {
    return {
        qualifier:
            summary.unreadCount > 0
                ? `${String(summary.unreadCount)} new`
                : formatRelativeTime(summary.latestReplyAt, now),
        replyLabel: `${String(summary.replyCount)} ${summary.replyCount === 1 ? 'reply' : 'replies'}`,
        unread: summary.unreadCount > 0,
    };
}

export function ThreadReplyPill({
    onClick,
    summary,
}: {
    onClick: () => void;
    summary: ThreadReplySummary;
}) {
    const now = useRelativeNow();
    const text = getThreadReplyPillText(summary, now);

    return (
        <button
            className="mt-1.5 inline-flex h-7 w-fit items-center gap-1.5 rounded-lg border border-separator bg-surface-secondary px-2.5 font-medium text-muted text-sm hover:bg-surface-tertiary hover:text-foreground"
            onClick={onClick}
            type="button"
        >
            <Icon className="size-3.5" icon={BubbleChatIcon} />
            <span>{text.replyLabel}</span>
            <span aria-hidden>·</span>
            <span className={cn(text.unread ? 'text-danger' : 'font-normal')}>
                {text.qualifier}
            </span>
        </button>
    );
}
