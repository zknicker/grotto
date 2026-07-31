'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { Tabs } from '@base-ui/react/tabs';
import { useRender } from '@base-ui/react/use-render';
import type { IconSvgElement } from '@hugeicons/react';
import type React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';

export function Card({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'relative flex flex-col rounded-xl border border-border-strong bg-card not-dark:bg-clip-padding text-card-foreground dark:border-border dark:shadow-xs/5 dark:before:pointer-events-none dark:before:absolute dark:before:inset-0 dark:before:rounded-[calc(var(--radius-xl,0.75rem)-1px)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]',
            className
        ),
        'data-slot': 'card',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardHeader({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 in-[[data-slot=card]:has(>[data-slot=card-content])]:pb-4 has-data-[slot=card-action]:grid-cols-[1fr_auto]',
            className
        ),
        'data-slot': 'card-header',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardTitle({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('font-semibold text-base leading-none', className),
        'data-slot': 'card-title',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardDescription({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('text-muted-foreground text-sm', className),
        'data-slot': 'card-description',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardAction({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'col-start-2 row-span-2 row-start-1 inline-flex self-start justify-self-end',
            className
        ),
        'data-slot': 'card-action',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardContent({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'flex-1 p-6 in-[[data-slot=card]:has(>[data-slot=card-header]:not(.border-b))]:pt-0 in-[[data-slot=card]:has(>[data-slot=card-footer]:not(.border-t))]:pb-0',
            className
        ),
        'data-slot': 'card-content',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardFooter({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'flex items-center p-6 in-[[data-slot=card]:has(>[data-slot=card-content])]:pt-4',
            className
        ),
        'data-slot': 'card-footer',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardFrame({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'relative flex flex-col overflow-hidden rounded-xl border border-border-strong bg-card not-dark:bg-clip-padding text-card-foreground *:data-[slot=card]:-m-px *:data-[slot=card]:rounded-none *:data-[slot=card]:border-x-0 *:data-[slot=card]:bg-clip-padding *:data-[slot=card]:shadow-none *:last:data-[slot=card]:border-b-0 *:first:data-[slot=card]:border-t-0 *:data-[slot=card]:before:hidden dark:border-border dark:shadow-xs/5 dark:before:pointer-events-none dark:before:absolute dark:before:inset-0 dark:before:rounded-[calc(var(--radius-xl,0.75rem)-1px)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]',
            className
        ),
        'data-slot': 'card-frame',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardFrameHeader({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('relative flex flex-col gap-1 px-5 py-4', className),
        'data-slot': 'card-frame-header',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardFrameTitle({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('font-semibold text-base leading-none', className),
        'data-slot': 'card-frame-title',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardFrameDescription({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('text-muted-foreground text-sm', className),
        'data-slot': 'card-frame-description',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardFrameFooter({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('px-6 py-4', className),
        'data-slot': 'card-frame-footer',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function CardPanel({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex flex-col gap-4 p-4', className),
        'data-slot': 'card-panel',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

/* ---------------------------------------------------------------------------
 * CardFrame Tabs – use with <CardFrame render={<Tabs.Root />}> to add
 * tabbed navigation to a CardFrame.
 * -------------------------------------------------------------------------*/

export function CardFrameTabList({ className, ...props }: Tabs.List.Props): React.ReactElement {
    return (
        <Tabs.List
            className={cn('relative grid auto-cols-fr grid-flow-col', className)}
            data-slot="card-frame-tab-list"
            {...props}
        />
    );
}

export function CardFrameTab({
    className,
    description,
    icon,
    title,
    ...props
}: Omit<Tabs.Tab.Props, 'children'> & {
    description?: string;
    icon?: IconSvgElement;
    title: string;
}): React.ReactElement {
    return (
        <Tabs.Tab
            className={cn(
                'relative flex cursor-pointer items-start gap-3 px-5 py-4 text-left outline-none transition-colors',
                'bg-legacy-muted text-muted-foreground/80 hover:bg-legacy-muted/50 hover:text-foreground/80',
                'dark:bg-transparent dark:hover:bg-legacy-muted/32',
                'not-first:border-border/50 not-first:border-l-2',
                'data-active:bg-transparent data-active:text-foreground',
                'dark:data-active:bg-legacy-muted/50 dark:data-active:text-foreground',
                className
            )}
            data-slot="card-frame-tab"
            {...props}
        >
            {icon ? <Icon className="size-6 shrink-0 self-center" icon={icon} /> : null}
            <div className="flex flex-col gap-1">
                <div className="font-semibold text-base leading-none">{title}</div>
                {description ? <div className="text-sm opacity-64">{description}</div> : null}
            </div>
        </Tabs.Tab>
    );
}

export function CardFrameTabPanel({ className, ...props }: Tabs.Panel.Props): React.ReactElement {
    return (
        <Tabs.Panel
            className={cn(
                'flex-1 outline-none',
                '*:data-[slot=card]:-m-px *:data-[slot=card]:rounded-none *:data-[slot=card]:border-x-0 *:data-[slot=card]:bg-clip-padding *:data-[slot=card]:shadow-none *:last:data-[slot=card]:border-b-0 *:data-[slot=card]:before:hidden',
                className
            )}
            data-slot="card-frame-tab-panel"
            {...props}
        />
    );
}
