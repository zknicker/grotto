import { Avatar } from '@heroui/react';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

export type EntityAvatarSize = 'lg' | 'md' | 'sm';

export interface EntityAvatarProps {
    className?: string;
    name: string;
    /**
     * A stock step, or an exact pixel box for rail-scale slots (sidebar rows,
     * mention chips, thread reply previews) below HeroUI's 32px floor.
     */
    size?: EntityAvatarSize | number;
    src?: string | null;
}

/**
 * The one identity mark in the app — agents and people are identical here by
 * design, and every surface from the rail to a profile page renders this so
 * the shape stays consistent. Stock HeroUI `Avatar`: `sm` 32px, `md` 40px,
 * `lg` 48px. Uploaded image when there is one, initials otherwise.
 */
export function EntityAvatar({
    className,
    name,
    size = 'md',
    src,
}: EntityAvatarProps): React.ReactElement {
    // HeroUI sizes the avatar in CSS, so an exact box has to come through
    // inline style — the one place the design system reaches past the variant.
    const exact = typeof size === 'number';

    return (
        <Avatar
            className={cn(exact && 'shrink-0', className)}
            size={exact ? 'sm' : size}
            style={
                exact
                    ? { fontSize: Math.max(8, Math.round(size * 0.42)), height: size, width: size }
                    : undefined
            }
        >
            {src ? <Avatar.Image alt={`${name} avatar`} src={src} /> : null}
            <Avatar.Fallback>{getEntityInitials(name)}</Avatar.Fallback>
        </Avatar>
    );
}

/** One initial for a single-word name is too thin to read; two letters is the floor. */
export function getEntityInitials(name: string): string {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter((part) => part.length > 0);

    if (parts.length === 0) {
        return '?';
    }

    if (parts.length === 1) {
        return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
    }

    return `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}
