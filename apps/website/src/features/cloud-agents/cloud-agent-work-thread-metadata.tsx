import type { CloudAgentRun, CloudAgentWork } from '@grotto/api';
import { Button } from '@heroui/react';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import { formatTimestamp } from '../../lib/format.ts';
import {
    cloudAgentPresentationStatus,
    cloudAgentProviderLabels,
    cloudAgentStatusText,
    elapsedSince,
    spanBetween,
} from './cloud-agent-presentation.ts';
import { CloudAgentStatusDisc } from './cloud-agent-status-disc.tsx';
import { useCloudAgentCancelAction } from './use-cloud-agent-cancel-action.ts';

/**
 * The Cloud Agent work above its Thread, the way a Task states itself: where
 * the work runs, what it runs against, how it is going, and every Run it has
 * taken with that Run's own evidence. Cancel lives here beside the facts,
 * because this is the surface a human comes to when they want it stopped.
 */
export function CloudAgentWorkThreadMetadata({ work }: { work: CloudAgentWork }) {
    const now = useRelativeNow(work.terminalAt ? 60_000 : 5000);
    const cancel = useCloudAgentCancelAction(work);
    const status = cloudAgentPresentationStatus(work);

    return (
        // An outlined group, matching the Task metadata panel: the composer
        // below already owns the surface's one filled slab.
        <section
            aria-label={`Cloud Agent work: ${work.title}`}
            className="card-shell mb-4 border border-border px-4 py-3"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <dl className="flex flex-wrap gap-x-8 gap-y-3">
                    <Field label="Provider" value={cloudAgentProviderLabels[work.provider]} />
                    <Field label="Repository" value={work.repository} />
                    <Field label="Starting ref" value={work.startingRef ?? 'Default branch'} />
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <dt className="text-muted text-sm">Status</dt>
                        <dd className="flex min-h-7 min-w-0 items-center gap-1.5 text-sm">
                            <CloudAgentStatusDisc status={status} />
                            <span className="truncate">{cloudAgentStatusText(work, now)}</span>
                        </dd>
                    </div>
                </dl>
                {cancel.canCancel ? (
                    <Button
                        isDisabled={cancel.isPending}
                        onPress={cancel.requestCancel}
                        size="sm"
                        variant="danger-soft"
                    >
                        Cancel run
                    </Button>
                ) : null}
            </div>
            {work.runs.length > 0 ? <RunHistory now={now} runs={work.runs} /> : null}
        </section>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex min-w-0 max-w-64 flex-col gap-1.5">
            <dt className="text-muted text-sm">{label}</dt>
            <dd className="flex min-h-7 min-w-0 items-center truncate text-sm">{value}</dd>
        </div>
    );
}

/**
 * Every Run this work has taken, newest first. A retry or correction adds a
 * Run rather than replacing the last one, so a cancelled attempt keeps its
 * partial evidence beside the attempt that followed it.
 */
function RunHistory({ now, runs }: { now: number; runs: readonly CloudAgentRun[] }) {
    return (
        <ul className="mt-3 flex flex-col gap-1.5 border-separator border-t pt-3">
            {runs.map((run) => (
                <RunRow key={run.runId} now={now} run={run} />
            ))}
        </ul>
    );
}

function RunRow({ now, run }: { now: number; run: CloudAgentRun }) {
    const report = run.summary ?? run.errorCode;

    return (
        <li className="flex min-w-0 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5 text-sm">
                <CloudAgentStatusDisc status={run.status} />
                <span className="shrink-0 capitalize">{run.status}</span>
                <span className="min-w-0 truncate text-muted">{runTiming(run, now)}</span>
            </span>
            {report ? <span className="min-w-0 truncate text-muted text-xs">{report}</span> : null}
        </li>
    );
}

function runTiming(run: CloudAgentRun, now: number): string {
    if (!run.startedAt) {
        return 'Not started';
    }
    const duration = run.terminalAt
        ? spanBetween(run.startedAt, run.terminalAt)
        : elapsedSince(run.startedAt, now);
    const started = formatTimestamp(run.startedAt);
    return duration ? `${started} · ${duration}` : started;
}
