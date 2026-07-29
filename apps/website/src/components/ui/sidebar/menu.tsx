'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import { navSelectedClass } from '../nav.tsx';
import { Skeleton } from '../skeleton.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip.tsx';
import { useSidebarOptional } from './context.tsx';

export function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
    return (
        <ul
            className={cn('flex w-full min-w-0 flex-col gap-0.5', className)}
            data-sidebar="menu"
            data-slot="sidebar-menu"
            {...props}
        />
    );
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
    return (
        <li
            className={cn('group/menu-item relative', className)}
            data-sidebar="menu-item"
            data-slot="sidebar-menu-item"
            {...props}
        />
    );
}

const sidebarMenuButtonVariants = cva(
    'no-drag peer/menu-button group/menu-button flex w-full cursor-default items-center gap-2 overflow-hidden rounded-[9px] px-2 py-1 text-left font-medium text-sidebar-foreground text-sm outline-hidden ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 data-active:text-foreground data-disabled:opacity-50 data-active:active:bg-secondary data-disabled:active:bg-transparent data-active:hover:bg-secondary data-disabled:hover:bg-transparent data-active:hover:text-foreground data-disabled:hover:text-sidebar-foreground group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-2.5! [&>span:last-child]:truncate [&_svg]:size-5 [&_svg]:shrink-0',
    {
        defaultVariants: {
            size: 'default',
            variant: 'default',
        },
        variants: {
            size: {
                default: 'h-8',
                lg: 'h-11 text-sm group-data-[collapsible=icon]:p-0!',
                sm: 'h-6 text-xs',
            },
            variant: {
                default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                outline:
                    'bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            },
        },
    }
);

export function SidebarMenuButton({
    render,
    isActive = false,
    variant = 'default',
    size = 'default',
    tooltip,
    className,
    disabled,
    onClick,
    tabIndex,
    ...props
}: useRender.ComponentProps<'button'> &
    React.ComponentProps<'button'> & {
        isActive?: boolean;
        tooltip?: string | React.ComponentProps<typeof TooltipContent>;
    } & VariantProps<typeof sidebarMenuButtonVariants>) {
    const state = useSidebarOptional()?.state ?? 'expanded';
    const renderTooltipDisabledState = Boolean(disabled && tooltip);
    // Only surface the tooltip when the label is hidden (collapsed rail) or when a disabled
    // item must explain itself — otherwise it just duplicates the visible label and, over a
    // desktop content view, paints behind the native page.
    const showTooltip = Boolean(tooltip) && (state === 'collapsed' || renderTooltipDisabledState);
    const button = useRender({
        defaultTagName: 'button',
        props: mergeProps<'button'>(
            {
                'aria-disabled': renderTooltipDisabledState ? true : undefined,
                className: cn(
                    sidebarMenuButtonVariants({ variant, size }),
                    isActive && navSelectedClass,
                    className
                ),
                disabled: renderTooltipDisabledState ? undefined : disabled,
                onClick: renderTooltipDisabledState
                    ? (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                      }
                    : onClick,
                tabIndex: renderTooltipDisabledState ? -1 : tabIndex,
                type: render ? undefined : 'button',
            },
            props
        ),
        render: showTooltip ? <TooltipTrigger render={render} /> : render,
        state: {
            slot: 'sidebar-menu-button',
            sidebar: 'menu-button',
            size,
            active: isActive,
            disabled: renderTooltipDisabledState,
        },
    });

    if (!showTooltip) {
        return button;
    }

    const content = typeof tooltip === 'string' ? { children: tooltip } : tooltip;

    return (
        <Tooltip>
            {button}
            <TooltipContent
                align="start"
                collisionAvoidance={{ align: 'none', fallbackAxisSide: 'none', side: 'flip' }}
                collisionPadding={8}
                side="right"
                sideOffset={4}
                {...content}
            />
        </Tooltip>
    );
}

export function SidebarMenuAction({
    className,
    render,
    showOnHover = false,
    ...props
}: useRender.ComponentProps<'button'> &
    React.ComponentProps<'button'> & {
        showOnHover?: boolean;
    }) {
    return useRender({
        defaultTagName: 'button',
        props: mergeProps<'button'>(
            {
                className: cn(
                    'absolute top-2 right-1.5 flex aspect-square w-5 cursor-default items-center justify-center rounded-md p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 group-data-[collapsible=icon]:hidden md:after:hidden [&>svg]:size-4.5 [&>svg]:shrink-0',
                    showOnHover &&
                        'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 aria-expanded:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground md:opacity-0',
                    className
                ),
                type: 'button',
            },
            props
        ),
        render,
        state: {
            slot: 'sidebar-menu-action',
            sidebar: 'menu-action',
        },
    });
}

export function SidebarMenuBadge({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'pointer-events-none absolute right-1.5 flex h-5 min-w-5 items-center justify-center rounded-md px-1 font-medium text-sidebar-muted text-xs tabular-nums peer-hover/menu-button:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden peer-data-[size=default]/menu-button:top-2 peer-data-[size=lg]/menu-button:top-3 peer-data-[size=sm]/menu-button:top-1.5 peer-data-active/menu-button:text-sidebar-accent-foreground',
                className
            )}
            data-sidebar="menu-badge"
            data-slot="sidebar-menu-badge"
            {...props}
        />
    );
}

export function SidebarMenuSkeleton({
    className,
    showIcon = false,
    ...props
}: React.ComponentProps<'div'> & {
    showIcon?: boolean;
}) {
    const [width] = React.useState(() => `${Math.floor(Math.random() * 40) + 50}%`);

    return (
        <div
            className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
            data-sidebar="menu-skeleton"
            data-slot="sidebar-menu-skeleton"
            {...props}
        >
            {showIcon ? (
                <Skeleton className="size-4.5 rounded-md" data-sidebar="menu-skeleton-icon" />
            ) : null}
            <Skeleton
                className="h-4 max-w-(--skeleton-width) flex-1"
                data-sidebar="menu-skeleton-text"
                style={{ '--skeleton-width': width } as React.CSSProperties}
            />
        </div>
    );
}

export function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
    return (
        <ul
            className={cn(
                'mx-3.5 flex min-w-0 translate-x-px flex-col gap-0.5 border-sidebar-border border-l px-2.5 py-0.5 group-data-[collapsible=icon]:hidden',
                className
            )}
            data-sidebar="menu-sub"
            data-slot="sidebar-menu-sub"
            {...props}
        />
    );
}

export function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<'li'>) {
    return (
        <li
            className={cn('group/menu-sub-item relative', className)}
            data-sidebar="menu-sub-item"
            data-slot="sidebar-menu-sub-item"
            {...props}
        />
    );
}

export function SidebarMenuSubButton({
    render,
    size = 'md',
    isActive = false,
    className,
    ...props
}: useRender.ComponentProps<'a'> &
    React.ComponentProps<'a'> & {
        size?: 'sm' | 'md';
        isActive?: boolean;
    }) {
    return useRender({
        defaultTagName: 'a',
        props: mergeProps<'a'>(
            {
                className: cn(
                    'flex h-7 min-w-0 -translate-x-px cursor-default items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-hidden ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-[size=md]:text-sm data-[size=sm]:text-xs data-active:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
                    className
                ),
            },
            props
        ),
        render,
        state: {
            slot: 'sidebar-menu-sub-button',
            sidebar: 'menu-sub-button',
            size,
            active: isActive,
        },
    });
}
