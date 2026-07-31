import { formatShortTime } from '../../../../lib/format.ts';
import type { SessionHistoryAccessEventRowOutput } from '../../../../lib/trpc.tsx';

export function AccessEventLogEntry({ entry }: { entry: SessionHistoryAccessEventRowOutput }) {
    return (
        <div className="rounded-md border border-[color:var(--warning-border)] bg-[var(--warning-bg)] px-3 py-1.5">
            <div className="flex items-center gap-2">
                <span className="size-1 shrink-0 rounded-full bg-warning" />
                <span className="font-medium text-caption text-warning uppercase tracking-[0.16em]">
                    Access {entry.accessEvent.status}
                </span>
                <span className="font-mono text-caption text-muted-foreground tabular-nums">
                    {formatShortTime(entry.timestamp)}
                </span>
            </div>
            <p className="mt-1 text-foreground text-sm">
                {entry.accessEvent.toolName ?? 'session access'}
                {entry.accessEvent.targetSessionKey
                    ? ` → ${entry.accessEvent.targetSessionKey}`
                    : null}
            </p>
            {entry.accessEvent.errorMessage ? (
                <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-legacy-warning-foreground text-meta">
                    {entry.accessEvent.errorMessage}
                </p>
            ) : null}
        </div>
    );
}
