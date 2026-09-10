import { Chip } from '@heroui/react';

/**
 * A count badge for waiting work: a Chat's unread messages, and the sidebar's
 * Inbox count. One owner for the cap and the chip's shape, so the sidebar rows
 * and the Inbox never disagree about what 100 waiting items looks like.
 *
 * `ariaLabel` names what the number counts. It defaults to unread messages,
 * which is what the Chat rows that gave the chip its shape are counting.
 */
export function UnreadCountChip({ ariaLabel, count }: { ariaLabel?: string; count: number }) {
    return (
        <Chip
            aria-label={ariaLabel ?? `${count} unread`}
            className="min-w-5 justify-center tabular-nums"
            color="accent"
            size="sm"
            variant="primary"
        >
            {count > 99 ? '99+' : count}
        </Chip>
    );
}
