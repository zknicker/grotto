import { cn } from '../../lib/utils.ts';
import { Icon } from '../ui/icon.tsx';
import { getChannelColorStyle } from './channel-color-options.ts';
import { useChannelIconGlyph } from './channel-icon-catalog.ts';

// Sidebar and topbar boxes match the 24px agent avatars beside them;
// `inline` keeps the smaller chip for text rows, and `modal` fills a
// Modal.Icon slot so a dialog header can preview the channel itself.
const channelIconBoxVariants = {
    inline: {
        boxClassName:
            'size-5 rounded-lg bg-[var(--channel-color-bg-light,var(--default))] text-[var(--channel-color-light,var(--muted))] dark:bg-[var(--channel-color-bg-dark,var(--default))] dark:text-[var(--channel-color-dark,var(--muted))]',
        iconSize: 14,
    },
    modal: {
        boxClassName:
            'size-10 rounded-3xl bg-[var(--channel-color-bg-light,var(--default))] text-[var(--channel-color-light,var(--muted))] dark:bg-[var(--channel-color-bg-dark,var(--default))] dark:text-[var(--channel-color-dark,var(--muted))]',
        iconSize: 20,
    },
    sidebar: {
        boxClassName:
            'size-6 rounded-lg bg-[var(--channel-color-bg-light,var(--default))] text-[var(--channel-color-light,var(--muted))] dark:bg-[var(--channel-color-bg-dark,var(--default))] dark:text-[var(--channel-color-dark,var(--muted))]',
        iconSize: 16,
    },
    topbar: {
        boxClassName:
            'size-6 rounded-lg bg-[var(--channel-color-bg-light,var(--default))] text-[var(--channel-color-light,var(--muted))] dark:bg-[var(--channel-color-bg-dark,var(--default))] dark:text-[var(--channel-color-dark,var(--muted))]',
        iconSize: 16,
    },
} as const;

/**
 * A channel's icon in its colored box. `icon` names a curated hugeicons export
 * and `color` a palette preset id; either one null renders the default hash in
 * a muted box.
 */
export function ChannelIconBox({
    className,
    color,
    icon,
    iconClassName,
    size = 'sidebar',
}: {
    className?: string;
    color?: string | null;
    icon?: string | null;
    iconClassName?: string;
    size?: keyof typeof channelIconBoxVariants;
}) {
    const variant = channelIconBoxVariants[size];
    const glyph = useChannelIconGlyph(icon);

    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex shrink-0 items-center justify-center',
                variant.boxClassName,
                className
            )}
            style={getChannelColorStyle(color)}
        >
            <Icon
                className={cn('shrink-0', iconClassName)}
                icon={glyph}
                size={variant.iconSize}
                // Inline size so container rules like the sidebar menu
                // button's `[&_svg]:size-5` cannot inflate the glyph.
                style={{ height: variant.iconSize, width: variant.iconSize }}
            />
        </span>
    );
}
