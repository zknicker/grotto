import { HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from '../ui/icon.tsx';

// Sidebar and topbar boxes match the 24px agent-face art beside them;
// `inline` keeps the smaller chip for text rows (activity feed, menus).
const channelIconBoxVariants = {
    inline: {
        boxClassName:
            'size-5 rounded-md bg-[var(--channel-color-bg-light,var(--sidebar-accent))] text-[var(--channel-color-light,var(--sidebar-muted))] dark:bg-[var(--channel-color-bg-dark,var(--sidebar-accent))] dark:text-[var(--channel-color-dark,var(--sidebar-muted))]',
        iconSize: 14,
    },
    sidebar: {
        boxClassName:
            'size-6 rounded-lg bg-[var(--channel-color-bg-light,var(--sidebar-accent))] text-[var(--channel-color-light,var(--sidebar-muted))] dark:bg-[var(--channel-color-bg-dark,var(--sidebar-accent))] dark:text-[var(--channel-color-dark,var(--sidebar-muted))]',
        iconSize: 16,
    },
    topbar: {
        boxClassName:
            'size-6 rounded-lg bg-[var(--channel-color-bg-light,var(--legacy-muted))] text-[var(--channel-color-light,var(--muted-foreground))] dark:bg-[var(--channel-color-bg-dark,var(--legacy-muted))] dark:text-[var(--channel-color-dark,var(--muted-foreground))]',
        iconSize: 16,
    },
} as const;

export function ChannelIconBox({
    className,
    iconClassName,
    size = 'sidebar',
    style,
}: {
    className?: string;
    iconClassName?: string;
    size?: keyof typeof channelIconBoxVariants;
    style?: React.CSSProperties;
}) {
    const variant = channelIconBoxVariants[size];

    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex shrink-0 items-center justify-center',
                variant.boxClassName,
                className
            )}
            style={style}
        >
            <Icon
                className={cn('shrink-0', iconClassName)}
                icon={HashtagIcon}
                size={variant.iconSize}
                // Inline size so container rules like the sidebar menu
                // button's `[&_svg]:size-5` cannot inflate the glyph.
                style={{ height: variant.iconSize, width: variant.iconSize }}
            />
        </span>
    );
}
