import type React from 'react';
import { cn } from '../../lib/utils.ts';

/**
 * One identity row, left-aligned: the mark, then a name line carrying the
 * record's badges, then one muted line with handle and description together.
 * The row's far end is a deliberate column — the labeled edit action over a
 * tertiary fact (`trailing`, a created date) — rather than a floating pencil
 * in the name line and a date adrift at the edge.
 */
export function MemberProfileHeader({
    action,
    avatar,
    badges,
    children,
    description,
    name,
    subtitle,
    trailing,
}: {
    action?: React.ReactNode;
    avatar: React.ReactNode;
    badges?: React.ReactNode;
    children?: React.ReactNode;
    description?: React.ReactNode;
    name: React.ReactNode;
    subtitle?: React.ReactNode;
    trailing?: React.ReactNode;
}) {
    return (
        <header className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 items-center gap-4">
                {avatar}
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                        {/* A profile is a page, so its name takes the page
                            title step — `text-2xl` with tight tracking, the
                            same as `SettingsPageHeader`. At `text-xl` it
                            sat between the section headings below it and
                            the title every sibling settings page uses. */}
                        <h1 className="min-w-0 truncate font-semibold text-2xl text-foreground tracking-tight">
                            {name}
                        </h1>
                        {badges}
                    </div>
                    {subtitle || description ? (
                        <p className="min-w-0 truncate text-muted text-sm">
                            {subtitle}
                            {subtitle && description ? ' · ' : null}
                            {description}
                        </p>
                    ) : null}
                </div>
                {action || trailing ? (
                    <div className="flex shrink-0 flex-col items-end gap-1.5 ps-4">
                        {action}
                        {trailing ? <span className="text-muted text-sm">{trailing}</span> : null}
                    </div>
                ) : null}
            </div>
            {children ? <div className="w-full min-w-0">{children}</div> : null}
        </header>
    );
}

export function MemberProfileFacts({ children }: { children: React.ReactNode }) {
    return (
        <dl className="flex min-w-0 flex-wrap items-start gap-x-8 gap-y-3 text-sm">{children}</dl>
    );
}

export function MemberProfileFact({
    className,
    label,
    value,
}: {
    className?: string;
    label: React.ReactNode;
    value: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col items-start gap-1 text-start">
            <dt className="order-2 truncate font-medium text-muted">{label}</dt>
            <dd
                className={cn(
                    'order-1 flex min-h-6 min-w-0 items-center truncate font-semibold text-foreground',
                    className
                )}
            >
                {value}
            </dd>
        </div>
    );
}
