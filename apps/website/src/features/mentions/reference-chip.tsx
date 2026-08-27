import { Chip } from '@heroui/react';
import type * as React from 'react';
import { getChannelColorStyle } from '../../components/chats/channel-color-options.ts';
import { cn } from '../../lib/utils.ts';
import {
    getMentionAppearance,
    getMentionDisplayLabel,
    MentionAppearanceIcon,
} from './mention-appearance.tsx';
import { getMentionChipColor } from './mention-chip-color.ts';
import type { ReferenceActivation, ReferenceKind } from './mention-types.ts';

export function ReferenceChip({
    className,
    id,
    kind,
    label,
    metadata,
    onActivate,
}: {
    className?: string;
    id: string;
    kind: ReferenceKind;
    label: string;
    metadata?: Record<string, unknown>;
    onActivate?: ReferenceActivation;
}) {
    const appearance = getMentionAppearance({ id, kind, label, metadata });
    const displayLabel = getMentionDisplayLabel({ id, kind, label, metadata });
    const activationTarget = { id, kind, label, metadata };
    const chipColor = getMentionChipColor(kind);
    const brandForeground = chipColor === 'default' ? appearance.brandColor : undefined;
    const channelColorStyle = appearance.channelAppearance
        ? getChannelColorStyle(appearance.channelAppearance.color)
        : undefined;
    const chipStyle =
        brandForeground || channelColorStyle
            ? ({
                  ...channelColorStyle,
                  ...(brandForeground ? { '--chip-fg': brandForeground } : {}),
              } as React.CSSProperties & Record<`--${string}`, string>)
            : undefined;
    const chip = (
        <Chip
            className={cn(
                'reference-chip max-w-full whitespace-nowrap align-middle',
                kind === 'chat' && 'reference-chip--channel',
                className
            )}
            color={chipColor}
            contentEditable={false}
            size="md"
            style={chipStyle}
            title={displayLabel}
            variant="tertiary"
        >
            <MentionAppearanceIcon
                agentAvatar={appearance.agentAvatar}
                channelAppearance={appearance.channelAppearance}
                className={cn(
                    'reference-chip__mark',
                    appearance.agentAvatar ? undefined : 'size-[18px] shrink-0 opacity-90'
                )}
                icon={appearance.icon}
                iconDataUrl={appearance.iconDataUrl}
            />
            <Chip.Label className="min-w-0 truncate font-semibold">{displayLabel}</Chip.Label>
        </Chip>
    );

    if (!onActivate || (kind !== 'agent' && kind !== 'chat')) {
        return chip;
    }

    return (
        <button
            aria-label={`Open ${displayLabel}`}
            className="inline-flex max-w-full cursor-(--cursor-interactive) rounded-lg align-middle outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={() => onActivate(activationTarget)}
            type="button"
        >
            {chip}
        </button>
    );
}
