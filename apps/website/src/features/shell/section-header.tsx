import type { ReactNode } from 'react';

/**
 * The band height every top-of-column zone shares: the shell topbar, local
 * SectionBars, and the sidebar frame's header zone. The value itself lives in
 * shell.css as --app-shell-band-height, because the native window's traffic
 * lights must be centered on the same number from outside the renderer.
 */
export const bandHeightClassName = 'h-[var(--app-shell-band-height)]';

/**
 * The one topbar band chrome: fixed height, bottom hairline, gutter. The
 * shell renders exactly one of these above the routed content
 * (ShellTopbar); embedded surfaces that need a local band (a panel, a tab
 * body) may render their own. The px-3 gutter matches the sidebar's stock
 * content gutter, so band content on both sides of the divider shares one
 * inset; routed content below keeps its own deeper reading gutter.
 */
export function SectionBar({ children }: { children?: ReactNode }) {
    return (
        <header
            className={`flex ${bandHeightClassName} shrink-0 items-center border-separator border-b px-3 has-[[data-shell-topbar-seam=hidden]]:border-b-transparent`}
        >
            {children}
        </header>
    );
}

/**
 * Topbar content row: optional leading icon, title, meta cluster, muted
 * description, optional centered slot, trailing actions. Carries no band
 * chrome — render it inside the shell band via PageTopbar, or inside a
 * local SectionBar. Title is for content identity (a chat's name); section
 * pages omit it — the rail and the window title already say where you are.
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
    title?: ReactNode;
}) {
    if (center) {
        // Equal flexible side columns anchor the center slot to the band's
        // true middle, so it does not drift with the title's width.
        return (
            <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    {leading}
                    {title ? (
                        <h1 className="min-w-0 shrink truncate font-semibold text-sm">{title}</h1>
                    ) : null}
                    {meta}
                    {description ? (
                        <p className="truncate text-muted text-xs">{description}</p>
                    ) : null}
                </div>
                <div className="flex min-w-0 items-center justify-center">{center}</div>
                <div className="flex min-w-0 items-center justify-end gap-2">{children}</div>
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-1 items-center gap-3">
            {leading}
            {title ? (
                <h1 className="min-w-0 shrink truncate font-semibold text-sm">{title}</h1>
            ) : null}
            {meta}
            {description ? <p className="truncate text-muted text-xs">{description}</p> : null}
            {children ? (
                <div className="ms-auto flex min-w-0 items-center gap-2">{children}</div>
            ) : null}
        </div>
    );
}
