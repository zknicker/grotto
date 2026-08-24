import { Button, useScrollShadow } from '@heroui/react';
import * as React from 'react';
import { cn } from '../../lib/utils.ts';

/**
 * Chat-owned attachment row. Pro `ChatAttachment` is a square composer tile
 * (preview + remove) with no room for a filename, a metadata line, or a
 * download affordance, so rendered message attachments keep this row layout
 * on HeroUI semantic tokens instead.
 */
function Attachment({
    className,
    size = 'default',
    ...props
}: React.ComponentProps<'div'> & { size?: 'default' | 'sm' }) {
    return (
        <div
            className={cn(
                'group/attachment relative flex w-fit min-w-40 max-w-full shrink-0 flex-wrap items-center rounded-xl border border-separator bg-surface text-surface-foreground transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[>a,>button]:hover:bg-surface-hover',
                size === 'sm'
                    ? 'gap-2.5 text-xs has-data-[slot=attachment-media]:p-1.5 has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5'
                    : 'gap-2 text-sm has-data-[slot=attachment-media]:p-2 has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2',
                className
            )}
            data-size={size}
            data-slot="attachment"
            {...props}
        />
    );
}

function AttachmentMedia({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-secondary text-foreground group-data-[size=sm]/attachment:w-8 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
                className
            )}
            data-slot="attachment-media"
            {...props}
        />
    );
}

function AttachmentContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('min-w-0 max-w-full flex-1 leading-tight', className)}
            data-slot="attachment-content"
            {...props}
        />
    );
}

function AttachmentTitle({ className, ...props }: React.ComponentProps<'span'>) {
    return (
        <span
            className={cn('block min-w-0 max-w-full truncate font-medium', className)}
            data-slot="attachment-title"
            {...props}
        />
    );
}

function AttachmentDescription({ className, ...props }: React.ComponentProps<'span'>) {
    return (
        <span
            className={cn('mt-0.5 block min-w-0 max-w-full truncate text-muted text-xs', className)}
            data-slot="attachment-description"
            {...props}
        />
    );
}

function AttachmentActions({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('relative z-20 flex shrink-0 items-center', className)}
            data-slot="attachment-actions"
            {...props}
        />
    );
}

function AttachmentAction({ ...props }: React.ComponentProps<typeof Button>) {
    return <Button data-slot="attachment-action" isIconOnly size="sm" variant="ghost" {...props} />;
}

/** Full-tile overlay link — the whole attachment row is the download target. */
function AttachmentDownloadLink({ className, ...props }: React.ComponentProps<'a'>) {
    return (
        <a
            className={cn('absolute inset-0 z-10 outline-none', className)}
            data-slot="attachment-download-link"
            {...props}
        />
    );
}

function AttachmentGroup({ className, ...props }: React.ComponentProps<'div'>) {
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Stock HeroUI edge fade. The hook drives the mask off scroll position, so
    // the strip keeps owning its own snap scrolling.
    useScrollShadow({
        containerRef: containerRef as React.RefObject<HTMLElement>,
        isEnabled: true,
        offset: 0,
        orientation: 'horizontal',
        visibility: 'auto',
    });

    return (
        <div
            className={cn(
                'scroll-shadow scroll-shadow--fade scroll-shadow--horizontal scrollbar-none flex min-w-0 snap-x snap-mandatory scroll-px-1 gap-3 overscroll-x-contain py-1 *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start',
                className
            )}
            data-slot="attachment-group"
            ref={containerRef}
            {...props}
        />
    );
}

export {
    Attachment,
    AttachmentAction,
    AttachmentActions,
    AttachmentContent,
    AttachmentDescription,
    AttachmentDownloadLink,
    AttachmentGroup,
    AttachmentMedia,
    AttachmentTitle,
};
