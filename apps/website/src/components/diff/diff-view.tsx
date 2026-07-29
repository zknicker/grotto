import { useMemo } from 'react';
import { cn } from '../../lib/utils.ts';
import { buildDiffHunks, type DiffLine } from './diff-hunks.ts';

// The one diff renderer: unified view, line numbers, token colors. Used by
// the changed-files drawer and Wiki page history so every diff reads the same.
export function DiffView({
    afterText,
    beforeText,
    className,
    emptyLabel = 'No text changes.',
}: {
    afterText: null | string;
    beforeText: null | string;
    className?: string;
    emptyLabel?: string;
}) {
    const hunks = useMemo(
        () => buildDiffHunks(beforeText ?? '', afterText ?? ''),
        [beforeText, afterText]
    );

    if (hunks.length === 0) {
        return <p className="text-meta text-muted-foreground">{emptyLabel}</p>;
    }

    return (
        <div
            className={cn(
                'overflow-hidden rounded-md border border-border-subtle bg-card font-mono text-code',
                className
            )}
        >
            {hunks.map((hunk, hunkIndex) => (
                <div key={hunk.header}>
                    {hunkIndex > 0 ? (
                        <div className="border-border-subtle border-t bg-muted px-3 py-0.5 text-caption text-muted-foreground">
                            {hunk.header}
                        </div>
                    ) : null}
                    {hunk.lines.map((line, lineIndex) => (
                        <DiffViewLine key={`${hunk.header}-${String(lineIndex)}`} line={line} />
                    ))}
                </div>
            ))}
        </div>
    );
}

function DiffViewLine({ line }: { line: DiffLine }) {
    return (
        <div
            className={cn(
                'flex min-w-0 leading-5',
                line.kind === 'add' && 'bg-success-bg',
                line.kind === 'del' && 'bg-error-bg'
            )}
        >
            <span className="w-9 shrink-0 select-none pr-1.5 text-right text-foreground-quaternary tabular-nums">
                {line.oldLine ?? ''}
            </span>
            <span className="w-9 shrink-0 select-none pr-1.5 text-right text-foreground-quaternary tabular-nums">
                {line.newLine ?? ''}
            </span>
            <span
                aria-hidden
                className={cn(
                    'w-4 shrink-0 select-none text-center',
                    line.kind === 'add' && 'text-success-foreground',
                    line.kind === 'del' && 'text-destructive'
                )}
            >
                {line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ''}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-all pr-3">{line.text}</span>
        </div>
    );
}

export function DiffStatBadge({ additions, deletions }: { additions: number; deletions: number }) {
    if (additions === 0 && deletions === 0) {
        return null;
    }
    return (
        <span className="shrink-0 font-mono text-caption tabular-nums">
            {additions > 0 ? <span className="text-success-foreground">+{additions}</span> : null}
            {additions > 0 && deletions > 0 ? ' ' : null}
            {deletions > 0 ? <span className="text-destructive">−{deletions}</span> : null}
        </span>
    );
}
