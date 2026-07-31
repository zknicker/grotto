import { Disclosure } from '@heroui/react';
import { formatChatPaneTargetLink } from '@tavern/api/pane-links';
import { DiffStatBadge, DiffView } from '../../../components/diff/diff-view.tsx';
import { SelectionQuoteContainer } from '../../../components/quote/selection-quote.tsx';
import { useChatTurnFileChanges } from '../../../hooks/chats/use-chat-turn-file-changes.ts';
import { cn } from '../../../lib/utils.ts';
import { GenericToolDrawerBody } from './generic-tool-drawer-body.tsx';
import { readToolCallString, type ToolDrawerCall } from './tool-drawer-call.ts';

interface WorkspaceChangeSummary {
    additions: number;
    change: 'created' | 'deleted' | 'modified';
    deletions: number;
    omitted: 'binary' | 'too-large' | null;
    path: string;
}

// Changed-files drawer: the summary rows come from the activity arguments;
// per-file before/after contents load on demand from the turn's file-change
// evidence and render through the shared DiffView.
export function WorkspaceChangesDrawerBody({ call }: { call: ToolDrawerCall }) {
    const runId = readToolCallString(call.arguments.runId);
    const changes = parseChangeSummaries(call.arguments.changes);
    const truncated = call.arguments.truncated === true;
    const evidenceQuery = useChatTurnFileChanges(
        { runId: runId ?? '' },
        { enabled: Boolean(runId) }
    );

    if (changes.length === 0) {
        return <GenericToolDrawerBody call={call} />;
    }

    const evidenceByPath = new Map(
        (evidenceQuery.data?.changes ?? []).map((change) => [change.path, change])
    );

    return (
        <div className="space-y-1.5">
            {changes.map((change) => {
                const evidence = evidenceByPath.get(change.path);
                return (
                    <div
                        className="overflow-hidden rounded-lg border border-separator bg-surface-secondary"
                        key={change.path}
                    >
                        <Disclosure defaultExpanded={change.omitted === null}>
                            <Disclosure.Heading>
                                <Disclosure.Trigger className="w-full">
                                    <span className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover">
                                        <span
                                            className={cn(
                                                'shrink-0 font-medium text-caption uppercase tracking-wide',
                                                change.change === 'created' && 'text-success',
                                                change.change === 'deleted' && 'text-danger',
                                                change.change === 'modified' && 'text-muted'
                                            )}
                                        >
                                            {change.change}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate font-mono text-code text-foreground">
                                            {change.path}
                                        </span>
                                        <DiffStatBadge
                                            additions={change.additions}
                                            deletions={change.deletions}
                                        />
                                        <Disclosure.Indicator />
                                    </span>
                                </Disclosure.Trigger>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <WorkspaceChangeDiff
                                        change={change}
                                        evidence={evidence ?? null}
                                        isPending={evidenceQuery.isPending && Boolean(runId)}
                                    />
                                </Disclosure.Body>
                            </Disclosure.Content>
                        </Disclosure>
                    </div>
                );
            })}
            {truncated ? (
                <p className="px-1 text-muted/70 text-xs">
                    Some changes were omitted because this turn touched more files than the evidence
                    keeps.
                </p>
            ) : null}
        </div>
    );
}

function WorkspaceChangeDiff({
    change,
    evidence,
    isPending,
}: {
    change: WorkspaceChangeSummary;
    evidence: null | { afterText: null | string; beforeText: null | string };
    isPending: boolean;
}) {
    if (change.omitted === 'binary') {
        return <p className="text-muted text-xs">Binary file changed.</p>;
    }
    if (change.omitted === 'too-large') {
        return <p className="text-muted text-xs">File changed (too large to diff).</p>;
    }
    if (isPending && !evidence) {
        return <p className="text-muted text-xs">Loading diff…</p>;
    }
    if (!evidence) {
        return <p className="text-muted text-xs">Diff is unavailable.</p>;
    }
    return (
        <SelectionQuoteContainer
            source={{
                href: formatChatPaneTargetLink({ kind: 'workspaceFile', path: change.path }),
                label: change.path,
            }}
        >
            <DiffView afterText={evidence.afterText} beforeText={evidence.beforeText} />
        </SelectionQuoteContainer>
    );
}

function parseChangeSummaries(value: unknown): WorkspaceChangeSummary[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return [];
        }
        const record = entry as Record<string, unknown>;
        const path = typeof record.path === 'string' ? record.path : null;
        const change =
            record.change === 'created' ||
            record.change === 'deleted' ||
            record.change === 'modified'
                ? record.change
                : null;
        if (!(path && change)) {
            return [];
        }
        return [
            {
                additions: typeof record.additions === 'number' ? record.additions : 0,
                change,
                deletions: typeof record.deletions === 'number' ? record.deletions : 0,
                omitted:
                    record.omitted === 'binary' || record.omitted === 'too-large'
                        ? record.omitted
                        : null,
                path,
            },
        ];
    });
}
