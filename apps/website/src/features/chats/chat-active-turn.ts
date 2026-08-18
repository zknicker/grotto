import { formatWorkGroupSummary, isActivityItem } from './chat-transcript-activity-utils.ts';
import {
    buildTranscriptEntries,
    getItemRunId,
    type TranscriptRow,
    type TranscriptTurnEntry,
} from './chat-transcript-model.ts';
import type { TranscriptActiveReply } from './transcript-contract.ts';

// One in-flight agent turn as a transcript entry — the same grouping the
// transcript pane uses, so the status row and turn drawer stay consistent
// with it.
export function findActiveTurnEntry(input: {
    activeReplies: readonly TranscriptActiveReply[];
    rows: TranscriptRow[];
    runId: string;
}): TranscriptTurnEntry | null {
    const entries = buildTranscriptEntries({
        activeReplies: input.activeReplies,
        rows: input.rows,
    });

    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];

        if (
            entry?.kind === 'turn' &&
            entry.participant === 'agent' &&
            entry.items.some(
                (item) =>
                    (item.kind === 'activeReply' || item.kind === 'activeStatus') &&
                    item.reply.runId === input.runId
            )
        ) {
            return entry;
        }
    }

    return null;
}

// The most recent agent turn, active or completed — the turn drawer's entry
// source once its run has settled into durable rows. A runId narrows the
// search to that run's turn.
export function findLastAgentTurnEntry(input: {
    rows: TranscriptRow[];
    runId?: string;
}): TranscriptTurnEntry | null {
    const entries = buildTranscriptEntries({
        activeReplies: [],
        rows: input.rows,
    });

    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];

        if (entry?.kind !== 'turn' || entry.participant !== 'agent') {
            continue;
        }

        if (!input.runId || entry.items.some((item) => getItemRunId(item) === input.runId)) {
            return entry;
        }
    }

    return null;
}

// Cumulative tool-work summary for a turn ("Ran 3 commands, read 5 files"),
// reusing the work-drawer header vocabulary.
export function formatTurnWorkSummary(entry: TranscriptTurnEntry | null) {
    if (!entry) {
        return null;
    }

    const activityItems = entry.items.filter(isActivityItem);

    if (activityItems.length === 0) {
        return null;
    }

    return formatWorkGroupSummary(activityItems);
}
