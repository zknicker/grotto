import type { ReactNode } from 'react';

/**
 * The one page-header band for section pages: fixed height so every page
 * top aligns with the sidebar title band. Optional leading icon, title
 * left, optional meta cluster (status chips), optional muted description,
 * actions trail.
 */
export function SectionHeader({
    children,
    description,
    leading,
    meta,
    title,
}: {
    children?: ReactNode;
    description?: ReactNode;
    leading?: ReactNode;
    meta?: ReactNode;
    title: ReactNode;
}) {
    return (
        <header className="flex h-12 shrink-0 items-center gap-3 border-separator border-b px-4">
            {leading}
            <h1 className="min-w-0 shrink truncate font-semibold text-sm">{title}</h1>
            {meta}
            {description ? <p className="truncate text-muted text-xs">{description}</p> : null}
            {children ? (
                <div className="ms-auto flex min-w-0 items-center gap-2">{children}</div>
            ) : null}
        </header>
    );
}
