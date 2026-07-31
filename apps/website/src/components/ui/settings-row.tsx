import type React from 'react';
import { cn } from '../../lib/utils.ts';
import { Card, CardFrame } from './card.tsx';
import { FieldError } from './primitives/field.tsx';

type SettingsItemProps = React.ComponentProps<'div'>;
type SettingsActionRowProps = React.ComponentProps<'button'>;
type SettingsGroupProps = React.ComponentProps<'div'> & {
    contentClassName?: string;
};
type SettingsPageHeaderProps = Omit<React.ComponentProps<'header'>, 'title'> & {
    action?: React.ReactNode;
    description?: React.ReactNode;
    title: React.ReactNode;
};
type SettingsPageProps = React.ComponentProps<'div'>;
type SettingsSectionProps = Omit<React.ComponentProps<'section'>, 'title'> & {
    action?: React.ReactNode;
    title: React.ReactNode;
};

interface SettingsRowProps {
    children: React.ReactNode;
    className?: string;
    density?: 'default' | 'compact';
    description?: React.ReactNode;
    error?: string | null;
    title: React.ReactNode;
    trailingWidth?: 'control' | 'intrinsic' | 'wide';
}

type SettingsValueProps = React.ComponentProps<'div'>;

export function SettingsPage({ className, ...props }: SettingsPageProps) {
    return <div className={cn('mx-auto grid w-full max-w-3xl gap-9 pb-2', className)} {...props} />;
}

export function SettingsPageHeader({
    action,
    className,
    description,
    title,
    ...props
}: SettingsPageHeaderProps) {
    return (
        <header
            className={cn('flex min-w-0 items-start justify-between gap-4 px-3', className)}
            {...props}
        >
            <div className="min-w-0 space-y-1">
                <h1 className="font-bold text-2xl text-foreground">{title}</h1>
                {description ? (
                    <p className="text-muted-foreground text-sm leading-tight">{description}</p>
                ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </header>
    );
}

export function SettingsItem({ className, ...props }: SettingsItemProps) {
    return <div className={cn('px-3.5 py-3.5', className)} {...props} />;
}

export function SettingsActionRow({ className, ...props }: SettingsActionRowProps) {
    return (
        <button
            className={cn(
                'no-drag flex w-full cursor-pointer items-center justify-center gap-2 px-3.5 py-2.5 font-medium text-foreground text-sm outline-none transition-colors hover:bg-legacy-accent/30 focus-visible:bg-legacy-accent/30 disabled:pointer-events-none disabled:opacity-64',
                className
            )}
            type="button"
            {...props}
        />
    );
}

export function SettingsSection({
    action,
    children,
    className,
    title,
    ...props
}: SettingsSectionProps) {
    return (
        <section className={cn('space-y-2', className)} {...props}>
            <div className="flex min-w-0 items-center justify-between gap-4 px-3">
                <h2 className="min-w-0 font-medium font-mono text-muted-foreground text-sm uppercase tracking-wider">
                    {title}
                </h2>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            {children}
        </section>
    );
}

export function SettingsGroup({
    children,
    className,
    contentClassName,
    ...props
}: SettingsGroupProps) {
    return (
        <CardFrame className={cn('rounded-xl bg-card shadow-none', className)}>
            <Card className={cn('overflow-hidden p-0', contentClassName)} {...props}>
                {children}
            </Card>
        </CardFrame>
    );
}

export function SettingsRow({
    children,
    className,
    density = 'default',
    description,
    error = null,
    title,
    trailingWidth = 'control',
}: SettingsRowProps) {
    return (
        <div
            className={cn(
                'grid gap-3 py-3.5 md:items-center md:gap-6',
                rowTrailingWidthClass[trailingWidth],
                density === 'default' ? 'ps-5 pe-3.5' : 'px-3.5',
                className
            )}
        >
            <div className="space-y-0.5">
                <h3 className="font-medium text-foreground text-sm leading-tight">{title}</h3>
                {description ? (
                    <div className="text-meta text-muted-foreground leading-tight">
                        {description}
                    </div>
                ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-2 md:w-full md:justify-self-end">
                {children}
                {error ? <FieldError>{error}</FieldError> : null}
            </div>
        </div>
    );
}

export function SettingsValue({ className, ...props }: SettingsValueProps) {
    return (
        <div
            className={cn(
                'flex min-h-8 items-center text-muted-foreground text-sm md:justify-end md:text-right',
                className
            )}
            {...props}
        />
    );
}

const rowTrailingWidthClass = {
    control: 'md:grid-cols-[minmax(10rem,1fr)_minmax(16rem,17rem)]',
    intrinsic: 'md:grid-cols-[minmax(0,1fr)_auto]',
    wide: 'md:grid-cols-[minmax(10rem,1fr)_minmax(20rem,42rem)]',
} satisfies Record<NonNullable<SettingsRowProps['trailingWidth']>, string>;
