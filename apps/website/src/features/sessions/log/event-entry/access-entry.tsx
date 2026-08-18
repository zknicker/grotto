import { formatShortTime } from '../../../../lib/format.ts';
import type { TranscriptSystemRow } from '../../../chats/transcript-contract.ts';

type AccessEventRow = Extract<TranscriptSystemRow, { systemKind: 'accessEvent' }>;

export function AccessEventLogEntry({ entry }: { entry: AccessEventRow }) {
    return (
        <div className="rounded-md border border-warning-soft bg-warning-soft px-3 py-1.5">
            <div className="flex items-center gap-2">
                <span className="font-medium text-warning text-xs uppercase tracking-[0.16em]">
                    Access {entry.accessEvent.status}
                </span>
                <span className="font-mono text-muted text-xs tabular-nums">
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
                <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-sm text-warning">
                    {entry.accessEvent.errorMessage}
                </p>
            ) : null}
        </div>
    );
}
