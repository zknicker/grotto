import type { TranscriptWorker } from '../chats/transcript-contract.ts';

export type WorkersFilterType = 'all' | 'acp' | 'cli' | 'cron' | 'subagent';

interface FilterWorkersParams {
    filter: WorkersFilterType;
    query: string;
    workers: TranscriptWorker[];
}

export function filterWorkers({ filter, query, workers }: FilterWorkersParams) {
    const normalizedQuery = query.trim().toLowerCase();

    return workers.filter((worker) => {
        if (filter !== 'all' && worker.kind !== filter) {
            return false;
        }

        if (normalizedQuery.length === 0) {
            return true;
        }

        const haystack = [
            worker.kind,
            worker.status,
            worker.title,
            worker.detail,
            worker.agentName,
            worker.chatTitle,
            worker.progressSummary,
            worker.terminalSummary,
            worker.error,
            worker.requesterSessionKey,
            worker.childSessionKey,
            worker.runId,
            worker.agentId,
        ]
            .filter((value): value is string => Boolean(value))
            .join('\n')
            .toLowerCase();

        return haystack.includes(normalizedQuery);
    });
}
