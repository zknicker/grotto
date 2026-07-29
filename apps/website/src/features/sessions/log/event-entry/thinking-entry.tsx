import * as React from 'react';
import { formatShortTime } from '../../../../lib/format.ts';
import type { SessionHistoryThinkingRowOutput } from '../../../../lib/trpc.tsx';

export function ThinkingLogEntry({ entry }: { entry: SessionHistoryThinkingRowOutput }) {
    const [isExpanded, setIsExpanded] = React.useState(false);

    return (
        <div className="max-w-xl">
            <button
                aria-expanded={isExpanded}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-ring bg-brand-muted px-2.5 py-1 text-left transition-colors hover:border-brand"
                onClick={() => setIsExpanded((value) => !value)}
                type="button"
            >
                <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                <span className="font-medium text-brand-muted-foreground text-caption uppercase tracking-[0.16em]">
                    Thinking
                </span>
                <span className="font-mono text-caption text-muted-foreground tabular-nums">
                    {formatShortTime(entry.timestamp)}
                </span>
                <span className="text-brand-muted-foreground text-caption">
                    {isExpanded ? 'Hide' : 'Inspect'}
                </span>
            </button>
            {isExpanded ? (
                <div className="mt-2 rounded-md border border-brand-ring bg-brand-muted px-3 py-2">
                    <p className="whitespace-pre-wrap text-foreground text-sm leading-relaxed">
                        {entry.thinking.text}
                    </p>
                </div>
            ) : null}
        </div>
    );
}
