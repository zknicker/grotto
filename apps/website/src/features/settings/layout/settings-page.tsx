import { Card, Chip } from '@heroui/react';
import type React from 'react';
import { cn } from '../../../lib/utils.ts';

/**
 * What is left of the settings composition layer after settings pages moved to
 * stock `ItemCardGroup`/`ItemCard`/`DataGrid`.
 *
 * Nothing here is used by `features/settings` any more except
 * `SettingsPageHeader`. The rest survives only for the member-profile, human
 * directory, and usage surfaces, whose hand-rolled children are still built
 * against `SettingsGroup`'s zero-padding geometry. Delete this file when those
 * move to `ItemCardGroup` — do not add to it, and do not reach for it from a
 * new surface.
 */
/**
 * A settings page's identity: title and optional description. Page-level
 * actions do not belong here — they go in the shell band through `PageTopbar`,
 * which is otherwise empty on settings routes.
 */
export function SettingsPageHeader({
    className,
    description,
    title,
    ...props
}: Omit<React.ComponentProps<'header'>, 'title'> & {
    description?: React.ReactNode;
    title: React.ReactNode;
}) {
    return (
        <header className={cn('min-w-0 space-y-1 px-1', className)} {...props}>
            <h1 className="font-bold text-2xl text-foreground">{title}</h1>
            {description ? <p className="text-muted text-sm leading-tight">{description}</p> : null}
        </header>
    );
}

export function SettingsSection({
    action,
    children,
    className,
    title,
    ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
    action?: React.ReactNode;
    title: React.ReactNode;
}) {
    return (
        <section className={cn('space-y-2', className)} {...props}>
            <div className="flex min-w-0 items-center justify-between gap-4 px-1">
                <h2 className="min-w-0 font-medium text-muted text-sm">{title}</h2>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            {children}
        </section>
    );
}

export function SettingsGroup({ children, className, ...props }: React.ComponentProps<'div'>) {
    return (
        <Card className={cn('gap-0 overflow-hidden p-0', className)} {...props}>
            {children}
        </Card>
    );
}

export function SettingsItem({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('px-4 py-3.5', className)} {...props} />;
}

/**
 * A row of small labelled facts, each value carried by a stock Chip. Use for
 * settings a reader scans rather than reads — a configuration summary — where
 * one line beats a stack of label/value rows.
 */
export function SettingsChipRow({ children, className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex flex-wrap items-start gap-x-8 gap-y-4 px-5 py-4', className)}
            {...props}
        >
            {children}
        </div>
    );
}

export function SettingsChipField({
    color = 'default',
    label,
    value,
}: {
    color?: React.ComponentProps<typeof Chip>['color'];
    label: React.ReactNode;
    value: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-muted text-xs leading-none">{label}</span>
            <Chip color={color} size="sm" variant="soft">
                <Chip.Label>{value}</Chip.Label>
            </Chip>
        </div>
    );
}
