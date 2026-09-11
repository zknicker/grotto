import type { Agent } from '@grotto/api';
import { ItemCard, PressableFeedback } from '@heroui-pro/react';
import type { ReactNode } from 'react';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { AgentAvatar } from '../../members/agent-avatar.tsx';

/** Every Inbox row leads with a mark at this size, Agent or Channel alike. */
export const inboxRowMarkSize = 32;

/**
 * One Inbox row: a stock `ItemCard`, with the whole band as the way in.
 *
 * The press target is a button laid over the card rather than the card itself
 * rendered as one. A row can carry its own control — an Ask's recommended
 * step — and a button cannot contain a button, so the one pressable shape that
 * serves every row in the section puts the target underneath and lets a
 * control lift above it. Feedback is still stock: `PressableFeedback.Highlight`
 * reads its parent's own hover and press, so it works here exactly as it does
 * inside a pressable card.
 *
 * The row carries no height of its own. `ItemCard`'s padding around a 32px
 * mark is the band, which is the whole point of the recomposition: the list
 * this replaced pinned a 40px row and then spent CSS undoing the component's
 * spacing to fit it.
 */
export function InboxRow({
    children,
    label,
    onOpen,
}: {
    children: ReactNode;
    /** The row's accessible name; the overlay button carries no text of its own. */
    label: string;
    onOpen: () => void;
}) {
    return (
        <ItemCard className="item-card--inbox relative">
            <PressableFeedback.Highlight />
            <button
                aria-label={label}
                className="absolute inset-0 cursor-(--cursor-interactive) outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
                onClick={onOpen}
                type="button"
            />
            {children}
        </ItemCard>
    );
}

/**
 * The row's leading mark. It sits beside `ItemCard.Content` rather than inside
 * `ItemCard.Icon`: an avatar and a channel box are already marks with their own
 * ground, and the icon slot exists to give a bare glyph one.
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
 * The row's single line of text.
 *
 * `ItemCard.Content` stacks its title over its description, so the line itself
 * is a structural wrapper inside it — layout only; the type is still the card's
 * own Title and Description, arranged side by side rather than stacked.
 *
 * The title keeps its own width rather than shrinking to make room: it is the
 * thing being scanned, and a column of half-titles is a column you have to open
 * to read. Past 40% of the line it truncates, so one long title cannot take the
 * preview's width with it. The preview fills whatever the title leaves and is
 * the first thing to give way, the way an email list's preview does.
 */
export function InboxRowBody({ preview, title }: { preview: ReactNode; title: ReactNode }) {
    return (
        <ItemCard.Content>
            <span className="flex min-w-0 items-center gap-2">
                <ItemCard.Title className="max-w-[40%] shrink-0">{title}</ItemCard.Title>
                <ItemCard.Description className="min-w-0 flex-1">{preview}</ItemCard.Description>
            </span>
        </ItemCard.Content>
    );
}

/**
 * The trailing cluster: where the row came from, and the one control that acts
 * on it. It never wraps and never shrinks — a row's origin and its action are
 * the two things that must stay readable when the line runs out of width.
 */
export function InboxRowMeta({ children }: { children: ReactNode }) {
    return (
        <ItemCard.Action>
            <span className="flex items-center gap-2 text-muted text-xs">{children}</span>
        </ItemCard.Action>
    );
}
