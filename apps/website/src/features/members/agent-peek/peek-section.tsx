import { ItemCard, ItemCardGroup, PressableFeedback } from '@heroui-pro/react';
import type * as React from 'react';

/**
 * The peek's one section anatomy: a transparent group whose header carries the
 * title and, for a list, its row count — wrapping the rows below.
 *
 * A near-copy of `agent-profile/profile-list-section.tsx`. Two differences earn
 * the copy: the count is optional, because half of the peek's sections are a
 * single summary row rather than a list, and a section with nothing to show yet
 * renders its header alone instead of an empty box. Promote one of the two if a
 * third surface wants this shape.
 */
export function PeekSection({
    children,
    count,
    title,
}: {
    /** Null while the section's data is still settling: header only, no box. */
    children: React.ReactNode;
    count?: number;
    title: string;
}) {
    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>
                    {title}
                    {count === undefined ? null : (
                        <span className="ms-2 text-muted tabular-nums">{count}</span>
                    )}
                </ItemCardGroup.Title>
            </ItemCardGroup.Header>
            {children ? (
                <ItemCardGroup className="overflow-hidden">{children}</ItemCardGroup>
            ) : null}
        </ItemCardGroup>
    );
}

/**
 * Stock ItemCard rendered as a button, per its Pressable pattern. The handler
 * rides on ItemCard itself: `render` spreads the component's own props last.
 *
 * `label` names the destination for a row whose visible content is a summary or
 * a chip set — "2 reminders · 1 trigger" does not say that pressing it opens
 * the Agent's Automations. A row whose title already names its target passes
 * nothing and keeps its content as the accessible name.
 */
export function PeekPressableCard({
    children,
    label,
    onPress,
}: {
    children: React.ReactNode;
    label?: string;
    onPress: () => void;
}) {
    return (
        <ItemCard<'button'>
            aria-label={label}
            className="relative w-full cursor-(--cursor-interactive) overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={onPress}
            render={(props) => <button type="button" {...props} />}
        >
            <PressableFeedback.Highlight />
            {children}
        </ItemCard>
    );
}

/** The quiet single row an empty section keeps its shape with. */
export function PeekEmptyRow({ children }: { children: React.ReactNode }) {
    return (
        <ItemCard>
            <ItemCard.Content>
                <ItemCard.Description>{children}</ItemCard.Description>
            </ItemCard.Content>
        </ItemCard>
    );
}
