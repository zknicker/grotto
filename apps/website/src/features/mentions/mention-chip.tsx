import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import {
    getMentionAppearance,
    getMentionChipColor,
    getMentionDisplayLabel,
    MentionAppearanceIcon,
} from './mention-appearance.tsx';
import type { MentionKind } from './mention-types.ts';

export function MentionChip({
    className,
    id,
    kind,
    label,
    metadata,
}: {
    className?: string;
    id: string;
    kind: MentionKind;
    label: string;
    metadata?: Record<string, unknown>;
}) {
    const appearance = getMentionAppearance({ id, kind, label, metadata });
    const displayLabel = getMentionDisplayLabel({ id, kind, label, metadata });

    return (
        <span
            className={cn(
                // Fixed leading keeps the chip the same height in every
                // context (transcript, composer, drafts) instead of tracking
                // the surrounding line-height.
                'inline-flex max-w-full -translate-y-[0.05em] items-center gap-[0.22em] whitespace-nowrap rounded-md py-[0.06em] align-middle font-medium leading-[1.5]',
                appearance.agentAvatar ? 'pr-[0.5em] pl-[0.3em]' : 'px-[0.45em]',
                kind === 'skill'
                    ? [
                          'bg-[color-mix(in_srgb,var(--mention-chip-color)_15%,transparent)] dark:bg-[color-mix(in_srgb,var(--mention-chip-color)_26%,transparent)]',
                          'text-[color:var(--mention-chip-color)]',
                      ]
                    : [
                          'bg-[color-mix(in_srgb,var(--mention-chip-color)_12%,transparent)] dark:bg-[color-mix(in_srgb,var(--mention-chip-color)_22%,transparent)]',
                          'text-[color:color-mix(in_srgb,var(--mention-chip-color)_50%,var(--foreground)_50%)]',
                      ],
                className
            )}
            contentEditable={false}
            style={
                {
                    '--mention-chip-color': getMentionChipColor(appearance),
                } as React.CSSProperties
            }
            title={displayLabel}
        >
            <MentionAppearanceIcon
                agentAvatar={appearance.agentAvatar}
                className={cn(
                    'shrink-0 object-contain',
                    appearance.agentAvatar ? undefined : 'size-[1.02em] opacity-90'
                )}
                icon={appearance.icon}
                iconDataUrl={appearance.iconDataUrl}
            />
            <span className="truncate">{displayLabel}</span>
        </span>
    );
}
