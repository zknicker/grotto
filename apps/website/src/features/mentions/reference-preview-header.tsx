import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { type MentionAppearance, MentionAppearanceIcon } from './mention-appearance.tsx';

/**
 * The identity row every compact reference preview opens with: a small mark,
 * the reference's own title, and one muted `·` clause carrying whatever that
 * kind knows about itself — a Channel's last activity, a Skill's kind. Shared
 * so the two previews cannot drift on type scale or the grammar of that clause,
 * while each identity kind can tune its mark's visual weight. Agent previews
 * use the same title/`·` pairing at their own larger scale.
 */
export function ReferencePreviewHeader({
    appearance,
    children,
    markClassName,
    meta,
    title,
}: {
    appearance: MentionAppearance;
    children?: React.ReactNode;
    markClassName?: string;
    meta: string | null;
    title: string;
}) {
    return (
        <header className="flex min-w-0 flex-col gap-2">
            <div className="reference-hover-card__identity flex min-w-0 items-center gap-1.5">
                <MentionAppearanceIcon
                    agentAvatar={appearance.agentAvatar}
                    channelAppearance={appearance.channelAppearance}
                    className={cn('size-[18px] shrink-0', markClassName)}
                    icon={appearance.icon}
                    iconDataUrl={appearance.iconDataUrl}
                />
                <div className="flex min-w-0 items-baseline gap-1.5">
                    <strong className="truncate font-semibold text-base text-foreground">
                        {title}
                    </strong>
                    {meta ? <span className="shrink-0 text-muted text-sm">· {meta}</span> : null}
                </div>
            </div>
            {children}
        </header>
    );
}
