import { Button, Card, Chip } from '@heroui/react';
import type React from 'react';
import { cn } from '../../../lib/utils.ts';

/**
 * Settings composition layer on stock HeroUI: page column, header, Title Case
 * section labels, Card-backed groups, and the shared two-column row grid.
 * Composition and layout only — visual identity stays in the generated design
 * system.
 */

export function SettingsPage({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('mx-auto grid w-full max-w-3xl gap-8 pb-2', className)} {...props} />;
}

export function SettingsPageHeader({
    action,
    className,
    description,
    title,
    ...props
}: Omit<React.ComponentProps<'header'>, 'title'> & {
    action?: React.ReactNode;
    description?: React.ReactNode;
    title: React.ReactNode;
}) {
    return (
        <header
            className={cn('flex min-w-0 items-start justify-between gap-4 px-1', className)}
            {...props}
        >
            <div className="min-w-0 space-y-1">
                <h1 className="font-bold text-2xl text-foreground">{title}</h1>
                {description ? (
                    <p className="text-muted text-sm leading-tight">{description}</p>
                ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
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

export function SettingsRow({
    align = 'center',
    children,
    className,
    density = 'default',
    description,
    error = null,
    title,
    trailingWidth = 'control',
}: {
    align?: 'center' | 'start';
    children: React.ReactNode;
    className?: string;
    density?: 'default' | 'compact';
    description?: React.ReactNode;
    error?: string | null;
    title: React.ReactNode;
    trailingWidth?: 'control' | 'intrinsic' | 'wide';
}) {
    return (
        <div
            className={cn(
                'grid gap-3 py-3.5 md:gap-6',
                align === 'center' ? 'md:items-center' : 'md:items-start',
                rowTrailingWidthClass[trailingWidth],
                density === 'default' ? 'ps-5 pe-4' : 'px-4',
                className
            )}
        >
            <div className="space-y-0.5">
                <h3 className="font-medium text-foreground text-sm leading-tight">{title}</h3>
                {description ? (
                    <div className="text-muted text-sm leading-tight">{description}</div>
                ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-2 md:w-full md:justify-self-end">
                {children}
                {error ? <div className="text-danger text-sm">{error}</div> : null}
            </div>
        </div>
    );
}

export function SettingsValue({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'flex min-h-8 items-center text-muted text-sm md:justify-end md:text-right',
                className
            )}
            {...props}
        />
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

export function SettingsActionRow({
    children,
    ...props
}: Omit<React.ComponentProps<typeof Button>, 'fullWidth' | 'variant'>) {
    return (
        <Button fullWidth size="sm" variant="ghost" {...props}>
            {children}
        </Button>
    );
}

const rowTrailingWidthClass = {
    control: 'md:grid-cols-[minmax(10rem,1fr)_minmax(16rem,17rem)]',
    intrinsic: 'md:grid-cols-[minmax(0,1fr)_auto]',
    wide: 'md:grid-cols-[minmax(10rem,1fr)_minmax(20rem,42rem)]',
} satisfies Record<'control' | 'intrinsic' | 'wide', string>;
