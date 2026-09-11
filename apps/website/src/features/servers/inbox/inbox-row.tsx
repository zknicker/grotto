import type { Agent } from '@grotto/api';
import type { ReactNode } from 'react';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { AgentAvatar } from '../../members/agent-avatar.tsx';

/** Every Inbox row leads with a mark at this size, Agent or Channel alike. */
export const inboxRowMarkSize = 24;

/**
 * The row's leading mark, hung from the first text line.
 *
 * ListView centers a row's content, which is right for a one-line row and
 * wrong for these: an Inbox row runs to three or four lines, and a mark
 * floating halfway down that block belongs to none of them. The Inbox's
 * ListView modifier hangs the whole row from its top instead; this pulls the
 * mark back up by half the difference between the 24px mark and the 20px title
 * line, so it centers on the line it introduces rather than sitting below it.
 */
export function InboxRowMark({ children }: { children: ReactNode }) {
    return <span className="-mt-0.5 flex shrink-0">{children}</span>;
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

/** The row's text column: a title, one line of substance, one line of meta. */
export function InboxRowText({ children }: { children: ReactNode }) {
    return <span className="flex min-w-0 flex-col">{children}</span>;
}

/**
 * The trailing meta cluster. It rides down half a step to sit on the title
 * line, because the row itself now hangs from its top edge.
 */
export function InboxRowTrailing({ children }: { children: ReactNode }) {
    return <span className="mt-0.5 flex items-center gap-2">{children}</span>;
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
