import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import type { ReactNode } from 'react';

/**
 * One Inbox section: a title and whatever that section's own query resolved
 * to. Each section states its own result — a quiet one says so rather than
 * collapsing into the section above it.
 */
export function InboxSection({ children, title }: { children: ReactNode; title: string }) {
    return (
        <section>
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header>
                    <ItemCardGroup.Title>{title}</ItemCardGroup.Title>
                </ItemCardGroup.Header>
                {children}
            </ItemCardGroup>
        </section>
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

/** The settled, genuinely empty section: one quiet row under its own header. */
export function InboxSectionEmpty({ description }: { description: string }) {
    return (
        <ItemCardGroup className="overflow-hidden">
            <ItemCard>
                <ItemCard.Content>
                    <ItemCard.Description>{description}</ItemCard.Description>
                </ItemCard.Content>
            </ItemCard>
        </ItemCardGroup>
    );
}
