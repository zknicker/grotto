import { Chip } from '@heroui/react';

/**
 * A Chat's unread badge. One owner for the cap and the chip's shape, so the
 * sidebar row and the Inbox never disagree about what 100 unread looks like.
 */
export function UnreadCountChip({ count }: { count: number }) {
    return (
        <Chip
            aria-label={`${count} unread`}
            className="min-w-5 justify-center tabular-nums"
            color="accent"
            size="sm"
            variant="primary"
        >
            {count > 99 ? '99+' : count}
        </Chip>
    );
}
