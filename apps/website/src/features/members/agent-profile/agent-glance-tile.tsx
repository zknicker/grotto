import { Chip } from '@heroui/react';
import { ItemCard, PressableFeedback } from '@heroui-pro/react';
import type * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';

export interface GlanceValue {
    color: React.ComponentProps<typeof Chip>['color'];
    label: string;
}

/**
 * Stock ItemCard rendered as a button, per its Pressable pattern — the same
 * anatomy the profile's list rows use, so a tile and a row read as one family.
 * A tile with nowhere to go (a Member cannot open Computers) renders inert
 * rather than as a button that refuses.
 */
export function GlanceTile({
    icon,
    label,
    onPress,
    secondary,
    value,
}: {
    icon: Parameters<typeof Icon>[0]['icon'];
    label: string;
    onPress?: () => void;
    secondary?: string;
    value: GlanceValue | null;
}) {
    const body = (
        <>
            <ItemCard.Icon>
                <Icon aria-hidden="true" icon={icon} />
            </ItemCard.Icon>
            <ItemCard.Content>
                <ItemCard.Title>{label}</ItemCard.Title>
                {secondary ? <ItemCard.Description>{secondary}</ItemCard.Description> : null}
            </ItemCard.Content>
            {value ? (
                <ItemCard.Action>
                    <Chip color={value.color} size="sm" variant="soft">
                        <Chip.Label className="tabular-nums">{value.label}</Chip.Label>
                    </Chip>
                </ItemCard.Action>
            ) : null}
        </>
    );

    if (!onPress) {
        return <ItemCard>{body}</ItemCard>;
    }

    return (
        <ItemCard<'button'>
            className="relative w-full cursor-(--cursor-interactive) overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={onPress}
            render={(props) => <button type="button" {...props} />}
        >
            <PressableFeedback.Highlight />
            {body}
        </ItemCard>
    );
}
