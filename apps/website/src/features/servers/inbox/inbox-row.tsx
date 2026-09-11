import type { Agent } from '@grotto/api';
import { ListView } from '@heroui-pro/react';
import type { ReactNode } from 'react';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { AgentAvatar } from '../../members/agent-avatar.tsx';

/** Every Inbox row leads with a mark at this size, Agent or Channel alike. */
export const inboxRowMarkSize = 24;

/**
 * The row's leading mark.
 *
 * An Inbox row is one line tall, so the mark centers on the row the way
 * ListView already centers everything else in it. It used to hang from the
 * row's top edge with a half-step nudge, because a three-line row gave a
 * centered mark no line to belong to; one line removes both the problem and
 * the correction.
 */
export function InboxRowMark({ children }: { children: ReactNode }) {
    return <span className="flex shrink-0">{children}</span>;
}

/**
 * One identity grammar for every Inbox row: the Agent's own face when the
 * Server still knows it, and its initials when the Agent is gone.
 */
export function InboxIdentityMark({
    agent,
    avatarUrl,
    name,
}: {
    agent: Agent | null;
    avatarUrl?: null | string;
    name: string;
}) {
    return (
        <InboxRowMark>
            {agent ? (
                <AgentAvatar agent={agent} size={inboxRowMarkSize} />
            ) : (
                <EntityAvatar name={name} size={inboxRowMarkSize} src={avatarUrl ?? null} />
            )}
        </InboxRowMark>
    );
}

/**
 * A glyph standing in for a face: a brand logo centered in the same mark
 * column the Agent avatars occupy, so a Cloud Agent row and an Agent row share
 * one text edge. No box — a provider logo is already a mark, and putting a
 * ground behind it only competes with the avatars beside it.
 */
export function InboxGlyphMark({ children }: { children: ReactNode }) {
    return (
        <InboxRowMark>
            <span
                className="flex items-center justify-center"
                style={{ height: inboxRowMarkSize, width: inboxRowMarkSize }}
            >
                {children}
            </span>
        </InboxRowMark>
    );
}

/**
 * The row's single line of text. Layout only — the type comes from ListView's
 * own Title and Description, which this arranges side by side rather than
 * stacked.
 */
export function InboxRowLine({ children }: { children: ReactNode }) {
    return <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>;
}

/**
 * What the row is. It keeps its own width rather than shrinking to make room:
 * the title is the thing being scanned, and a column of half-titles is a
 * column you have to open to read. Past 40% of the line it truncates, so one
 * long title cannot take the preview's width with it.
 */
export function InboxRowTitle({ children }: { children: ReactNode }) {
    return <ListView.Title className="max-w-[40%] shrink-0">{children}</ListView.Title>;
}

/**
 * What is waiting behind the title. It fills whatever the title leaves and is
 * the first thing to give way, the way an email list's preview does.
 */
export function InboxRowPreview({ children }: { children: ReactNode }) {
    return <ListView.Description className="min-w-0 flex-1">{children}</ListView.Description>;
}

/**
 * The trailing cluster: where the row came from, and the one control that acts
 * on it. It never wraps and never shrinks — a row's origin and its action are
 * the two things that must stay readable when the line runs out of width.
 */
export function InboxRowMeta({ children }: { children: ReactNode }) {
    return <div className="flex shrink-0 items-center gap-2 text-muted text-xs">{children}</div>;
}
