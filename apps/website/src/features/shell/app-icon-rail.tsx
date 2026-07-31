import type * as React from 'react';
import { navSelectedClass } from '../../components/ui/nav.tsx';
import { cn } from '../../lib/utils.ts';

export interface AppIconRailItem {
    content: React.ReactNode;
    disabled?: boolean;
    id: string;
    isActive: boolean;
    label: string;
    onClick: () => void;
    unseen?: boolean;
}

export function AppIconRailView({
    activityStrip,
    items,
    settings,
}: {
    activityStrip?: React.ReactNode;
    items: AppIconRailItem[];
    settings: AppIconRailItem;
}) {
    return (
        <nav
            aria-label="Sections"
            className="app-shell-sidebar-top-inset relative z-30 flex w-12 shrink-0 flex-col items-center gap-1 bg-[var(--sidebar)] pb-2"
        >
            {items.map((item) => (
                <RailButton key={item.id} {...item}>
                    {item.content}
                </RailButton>
            ))}
            <div className="flex-1" />
            {activityStrip}
            <RailButton {...settings}>{settings.content}</RailButton>
        </nav>
    );
}

// Matches the nav-row selection language: solid secondary plate, inset input
// ring, and the 2px press slab (DESIGN.md "inked outline + press-slab").
function RailButton({
    children,
    disabled,
    isActive,
    label,
    onClick,
    unseen,
}: {
    children: React.ReactNode;
    disabled?: boolean;
    isActive: boolean;
    label: string;
    onClick: () => void;
    unseen?: boolean;
}) {
    return (
        <button
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
            className={cn(
                'no-drag relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-sidebar-foreground outline-none',
                isActive ? navSelectedClass : 'hover:bg-[var(--nav-hover)]',
                disabled ? 'cursor-default opacity-50' : null
            )}
            disabled={disabled}
            onClick={onClick}
            title={label}
            type="button"
        >
            {children}
            {unseen && !isActive ? (
                <span
                    aria-hidden="true"
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
                />
            ) : null}
        </button>
    );
}
