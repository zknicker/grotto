import type { ReactNode } from 'react';

/**
 * The one page-header band for section pages: fixed height so every page
 * top aligns with the sidebar title band. Title left, optional muted
 * description, actions trail.
 */
export function SectionHeader({
    children,
    description,
    title,
}: {
    children?: ReactNode;
    description?: ReactNode;
    title: ReactNode;
}) {
    return (
        <header className="flex h-12 shrink-0 items-center gap-3 border-separator border-b px-4">
            <h1 className="shrink-0 font-semibold text-sm">{title}</h1>
            {description ? <p className="truncate text-muted text-xs">{description}</p> : null}
            {children ? (
                <div className="ms-auto flex min-w-0 items-center gap-2">{children}</div>
            ) : null}
        </header>
    );
}
