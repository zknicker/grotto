import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

const emptyMediaVariants = cva(
    'flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
    {
        defaultVariants: {
            variant: 'default',
        },
        variants: {
            variant: {
                default: 'bg-transparent',
                icon: "relative flex size-9 shrink-0 items-center justify-center rounded-md border bg-card not-dark:bg-clip-padding text-foreground shadow-sm/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-md)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='size-'])]:size-4.5",
            },
        },
    }
);

export function Empty({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
    return (
        <div
            className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance px-6 py-12 text-center md:py-20',
                className
            )}
            data-slot="empty"
            {...props}
        />
    );
}

export function EmptyHeader({
    className,
    ...props
}: React.ComponentProps<'div'>): React.ReactElement {
    return (
        <div
            className={cn('flex max-w-sm flex-col items-center text-center', className)}
            data-slot="empty-header"
            {...props}
        />
    );
}

export function EmptyMedia({
    children,
    className,
    variant = 'default',
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>): React.ReactElement {
    return (
        <div
            className={cn('relative mb-6', className)}
            data-slot="empty-media"
            data-variant={variant}
            {...props}
        >
            {variant === 'icon' && (
                <>
                    <div
                        aria-hidden="true"
                        className={cn(
                            emptyMediaVariants({ className, variant }),
                            'pointer-events-none absolute bottom-px origin-bottom-left -translate-x-0.5 -rotate-10 scale-84 shadow-none'
                        )}
                    />
                    <div
                        aria-hidden="true"
                        className={cn(
                            emptyMediaVariants({ className, variant }),
                            'pointer-events-none absolute bottom-px origin-bottom-right translate-x-0.5 rotate-10 scale-84 shadow-none'
                        )}
                    />
                </>
            )}
            <div className={cn(emptyMediaVariants({ className, variant }))}>{children}</div>
        </div>
    );
}

/* Empty states come in two scales: `default` for a full page or route, `sm`
   for an empty region inside a panel, tab, or drawer where the page-level
   scale would shout. */
const emptyTitleVariants = cva('font-heading font-semibold', {
    defaultVariants: {
        size: 'default',
    },
    variants: {
        size: {
            default: 'text-xl',
            sm: 'text-base',
        },
    },
});

const emptyDescriptionVariants = cva(
    'text-muted-foreground [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4 [[data-slot=empty-title]+&]:mt-1',
    {
        defaultVariants: {
            size: 'default',
        },
        variants: {
            size: {
                default: 'text-base',
                sm: 'text-sm',
            },
        },
    }
);

export function EmptyTitle({
    className,
    size,
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyTitleVariants>): React.ReactElement {
    return (
        <div
            className={cn(emptyTitleVariants({ className, size }))}
            data-slot="empty-title"
            {...props}
        />
    );
}

export function EmptyDescription({
    className,
    size,
    ...props
}: React.ComponentProps<'p'> & VariantProps<typeof emptyDescriptionVariants>): React.ReactElement {
    return (
        <div
            className={cn(emptyDescriptionVariants({ className, size }))}
            data-slot="empty-description"
            {...props}
        />
    );
}

export function EmptyContent({
    className,
    ...props
}: React.ComponentProps<'div'>): React.ReactElement {
    return (
        <div
            className={cn(
                'flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm',
                className
            )}
            data-slot="empty-content"
            {...props}
        />
    );
}
