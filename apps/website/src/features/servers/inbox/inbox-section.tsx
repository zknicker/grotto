import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import type { ReactNode } from 'react';

/**
 * One Inbox section, and the page's only container grammar: a bordered group
 * whose header carries the title and whose body is that section's own rows.
 *
 * The group owns the inset, so a header and the rows beneath it line up on the
 * same edge and a row's hover fill has a card to stop against. Sections used to
 * be transparent headers floating over borderless lists, which read as three
 * unrelated islands with the fill starting outside its own heading.
 */
export function InboxSection({ children, title }: { children: ReactNode; title: ReactNode }) {
    return (
        // The group rounds its corners but does not clip them; the last row's
        // hover fill would square them off without this.
        <ItemCardGroup className="overflow-hidden">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>{title}</ItemCardGroup.Title>
            </ItemCardGroup.Header>
            {children}
        </ItemCardGroup>
    );
}

/**
 * The neutral region a section reserves while its query settles. An unresolved
 * query is not an empty collection, so nothing is claimed until it is — and
 * nothing flashes on the way there.
 */
export function InboxSectionPending({ label }: { label: string }) {
    return (
        <div aria-busy="true">
            <span className="sr-only">{label}</span>
        </div>
    );
}

/**
 * The settled, genuinely empty section: one quiet row inside its own group,
 * carrying the same inset as the rows it stands in for.
 */
export function InboxSectionEmpty({ description }: { description: string }) {
    return (
        <ItemCard>
            <ItemCard.Content>
                <ItemCard.Description>{description}</ItemCard.Description>
            </ItemCard.Content>
        </ItemCard>
    );
}

/**
 * A section title with no card under it. The Inbox has exactly one such
 * section — the week strip, whose cards already carry their own edges — and it
 * still has to read as a peer of the carded sections beside it, so the label
 * borrows the group header's own type rather than inventing a second heading
 * tier.
 */
export function InboxSectionLabel({ children }: { children: ReactNode }) {
    return <h2 className="font-semibold text-foreground text-sm">{children}</h2>;
}
