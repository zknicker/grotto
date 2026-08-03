import type { SessionHistoryArtifactRowOutput } from '../../../../lib/trpc.tsx';

export function ArtifactLogEntry({ entry }: { entry: SessionHistoryArtifactRowOutput }) {
    const label = getArtifactLabel(entry.artifact);

    return (
        <div className="flex items-center gap-2 rounded-md border border-success-soft bg-success-soft px-3 py-1.5">
            <span className="size-1 shrink-0 rounded-full bg-success" />
            <span className="font-medium text-success text-xs uppercase tracking-[0.16em]">
                {entry.artifact.artifactType}
            </span>
            <span className="min-w-0 truncate text-foreground/90 text-sm">{label}</span>
        </div>
    );
}

function getArtifactLabel(entry: SessionHistoryArtifactRowOutput['artifact']) {
    const payload =
        entry.payload && typeof entry.payload === 'object' && !Array.isArray(entry.payload)
            ? (entry.payload as Record<string, unknown>)
            : {};
    const title = readString(payload.title);
    const contentRef = readString(payload.contentRef);
    const contentText = readString(payload.contentText);

    return title ?? entry.path ?? contentRef ?? contentText ?? 'Stored artifact';
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
