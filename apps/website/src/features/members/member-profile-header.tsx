import type React from 'react';
import { cn } from '../../lib/utils.ts';

export function MemberProfileHeader({
    avatar,
    children,
    description,
    descriptionAction,
    name,
    nameAction,
    status,
    subtitle,
}: {
    avatar: React.ReactNode;
    children?: React.ReactNode;
    description?: React.ReactNode;
    descriptionAction?: React.ReactNode;
    name: React.ReactNode;
    nameAction?: React.ReactNode;
    status?: React.ReactNode;
    subtitle?: React.ReactNode;
}) {
    return (
        <header className="flex min-w-0 flex-col items-center gap-6 text-center">
            <div className="flex min-w-0 max-w-xl flex-col items-center gap-3">
                {avatar}
                <div className="flex min-w-0 flex-col items-center">
                    <div className="relative min-w-0">
                        <div className="flex min-w-0 items-center justify-center gap-2.5">
                            {/* A profile is a page, so its name takes the page
                                title step — `text-2xl` with tight tracking, the
                                same as `SettingsPageHeader`. At `text-xl` it
                                sat between the section headings below it and
                                the title every sibling settings page uses. */}
                            <h1 className="min-w-0 truncate font-semibold text-2xl text-foreground tracking-tight">
                                {name}
                            </h1>
                            {status}
                        </div>
                        {nameAction ? (
                            <div className="absolute top-1/2 left-full -translate-y-1/2">
                                {nameAction}
                            </div>
                        ) : null}
                    </div>
                    {subtitle ? <p className="text-muted text-sm">{subtitle}</p> : null}
                    {description ? (
                        <div className="relative mt-2 min-w-0">
                            <p className="line-clamp-2 text-pretty text-muted text-sm">
                                {description}
                            </p>
                            {descriptionAction ? (
                                <div className="absolute top-1/2 left-full -translate-y-1/2">
                                    {descriptionAction}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
            {children ? <div className="w-full min-w-0">{children}</div> : null}
        </header>
    );
}

export function MemberProfileFacts({ children }: { children: React.ReactNode }) {
    return (
        <dl className="flex min-w-0 flex-col items-center gap-4 text-sm sm:flex-row sm:flex-wrap sm:justify-center sm:gap-10">
            {children}
        </dl>
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
        <div className="flex min-w-0 flex-col items-center gap-1 text-center">
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
