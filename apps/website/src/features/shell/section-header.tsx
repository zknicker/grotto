import type { ReactNode } from 'react';

/**
 * The band height every top-of-column zone shares: the shell topbar, local
 * SectionBars, and the sidebar frame's header zone. One value, one place.
 */
export const bandHeightClassName = 'h-14';

/**
 * The one topbar band chrome: fixed height, bottom hairline, gutter. The
 * shell renders exactly one of these above the routed content
 * (ShellTopbar); embedded surfaces that need a local band (a panel, a tab
 * body) may render their own.
 */
export function SectionBar({ children }: { children?: ReactNode }) {
    return (
        <header
            className={`flex ${bandHeightClassName} shrink-0 items-center border-separator border-b px-4`}
        >
            {children}
        </header>
    );
}

/**
 * Topbar content row: optional leading icon, title, meta cluster, muted
 * description, optional centered slot, trailing actions. Carries no band
 * chrome — render it inside the shell band via PageTopbar, or inside a
 * local SectionBar.
 */
export function SectionHeader({
    center,
    children,
    description,
    leading,
    meta,
    title,
}: {
    center?: ReactNode;
    children?: ReactNode;
    description?: ReactNode;
    leading?: ReactNode;
    meta?: ReactNode;
    title: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-1 items-center gap-3">
            {leading}
            <h1 className="min-w-0 shrink truncate font-semibold text-sm">{title}</h1>
            {meta}
            {description ? <p className="truncate text-muted text-xs">{description}</p> : null}
            {center ? (
                <div className="flex min-w-0 flex-1 items-center justify-center">{center}</div>
            ) : null}
            {children ? (
                <div
                    className={
                        center
                            ? 'flex min-w-0 shrink-0 items-center gap-2'
                            : 'ms-auto flex min-w-0 items-center gap-2'
                    }
                >
                    {children}
                </div>
            ) : null}
        </div>
    );
}
