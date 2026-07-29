'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

/**
 * The canonical selected-nav treatment: an inked press slab — solid
 * `--secondary` fill, inset `--input` hairline, 2px `--hard-shadow` offset.
 * Every selected nav row (sidebar sections, channels, DMs, icon rail,
 * settings nav, file-tree rows) uses this one string; see DESIGN.md
 * "Colors". Surface only — call sites own their own text color. The hairline
 * rides in the same box-shadow as the slab so it never fights a `ring-*`
 * focus treatment.
 */
export const navSelectedClass =
    'bg-secondary shadow-[inset_0_0_0_1px_var(--input),0_2px_0_0_var(--hard-shadow)]';

export function Nav({
    className,
    render,
    ...props
}: useRender.ComponentProps<'nav'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex flex-col gap-px', className),
        'data-slot': 'nav',
    };

    return useRender({
        defaultTagName: 'nav',
        props: mergeProps<'nav'>(defaultProps, props),
        render,
    });
}

export function NavSectionLabel({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'px-2 pt-4 pb-1 font-medium font-mono text-[var(--nav-section-label)] text-xs uppercase tracking-wider',
            className
        ),
        'data-slot': 'nav-section-label',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function NavItem({
    active = false,
    className,
    render,
    ...props
}: useRender.ComponentProps<'button'> & {
    active?: boolean;
}): React.ReactElement {
    const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] = render
        ? undefined
        : 'button';

    const defaultProps = {
        className: cn(
            'no-drag group relative flex w-full items-center gap-2 rounded-md px-2 py-1 text-left font-medium text-meta transition-colors duration-150 ease-out',
            active
                ? cn(navSelectedClass, 'text-foreground duration-0')
                : 'text-foreground/75 hover:bg-[var(--nav-hover)] hover:text-foreground hover:duration-0',
            className
        ),
        'data-slot': 'nav-item',
        'data-active': active ? '' : undefined,
        type: typeValue,
    };

    return useRender({
        defaultTagName: 'button',
        props: mergeProps<'button'>(defaultProps, props),
        render,
    });
}

export function NavItemMeta({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'ml-auto shrink-0 pl-2 text-caption text-muted-foreground tabular-nums',
            className
        ),
        'data-slot': 'nav-item-meta',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function NavItemBadge({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-md bg-[var(--nav-hover)] px-1.5 font-medium text-foreground/85 text-micro tabular-nums',
            className
        ),
        'data-slot': 'nav-item-badge',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}
