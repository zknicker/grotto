import { Chip } from '@heroui/react';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import {
    getMentionAppearance,
    getMentionChipColor,
    getMentionDisplayLabel,
    MentionAppearanceIcon,
} from './mention-appearance.tsx';
import type { ReferenceKind } from './mention-types.ts';

export function ReferenceChip({
    className,
    id,
    kind,
    label,
    metadata,
}: {
    className?: string;
    id: string;
    kind: ReferenceKind;
    label: string;
    metadata?: Record<string, unknown>;
}) {
    const appearance = getMentionAppearance({ id, kind, label, metadata });
    const displayLabel = getMentionDisplayLabel({ id, kind, label, metadata });

    return (
        <Chip
            className={cn(
                'max-w-full -translate-y-px whitespace-nowrap align-middle text-sm',
                className
            )}
            contentEditable={false}
            size="sm"
            style={
                {
                    '--chip-bg': 'color-mix(in srgb, var(--reference-chip-color) 16%, transparent)',
                    '--chip-fg':
                        'color-mix(in srgb, var(--reference-chip-color) 50%, var(--foreground) 50%)',
                    '--reference-chip-color': getMentionChipColor(appearance),
                } as React.CSSProperties & Record<`--${string}`, string>
            }
            title={displayLabel}
            variant="soft"
        >
            <MentionAppearanceIcon
                agentAvatar={appearance.agentAvatar}
                className={appearance.agentAvatar ? undefined : 'size-[1.02em] shrink-0 opacity-90'}
                icon={appearance.icon}
                iconDataUrl={appearance.iconDataUrl}
            />
            <Chip.Label className="min-w-0 truncate">{displayLabel}</Chip.Label>
        </Chip>
    );
}
