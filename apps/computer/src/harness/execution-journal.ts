import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileExecutionJournal } from './execution-journal-file';
import { interruptTool, isJournalDocument, isMissingFile } from './execution-journal-values';

export type {
    ComputerExecutionJournal,
    ComputerExecutionJournalDocument,
    ComputerExecutionJournalResult,
    ComputerExecutionJournalStatus,
    ComputerExecutionJournalTool,
    JournalValue,
} from './execution-journal-types';

import type {
    ComputerExecutionJournal,
    ComputerExecutionJournalDocument,
} from './execution-journal-types';

const journalDirectory = 'execution-journal';
const runIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;

export async function createComputerExecutionJournal(input: {
    agentRoot: string;
    now?: () => Date;
    runId: string;
}): Promise<ComputerExecutionJournal> {
    const path = executionJournalPath(input.agentRoot, input.runId);
    const now = input.now ?? (() => new Date());
    const existing = await readComputerExecutionJournal(input.agentRoot, input.runId);
    const document: ComputerExecutionJournalDocument = existing ?? {
        runId: input.runId,
        startedAt: now().toISOString(),
        status: 'running',
        tools: [],
    };
    let changed = existing === null;
    if (existing) {
        for (const tool of document.tools) {
            if (tool.status !== 'running') {
                continue;
            }
            interruptTool(tool, now(), 'computer_restart');
            changed = true;
        }
        document.status = 'running';
        document.endedAt = undefined;
        document.error = undefined;
        changed = true;
    }
    const journal = new FileExecutionJournal(path, document, now);
    if (changed) {
        await journal.persist();
    }
    await mkdir(journalDirectoryPath(input.agentRoot), { mode: 0o700, recursive: true });
    return journal;
}

export async function readComputerExecutionJournal(
    agentRoot: string,
    runId: string
): Promise<ComputerExecutionJournalDocument | null> {
    const path = executionJournalPath(agentRoot, runId);
    let raw: string;
    try {
        raw = await readFile(path, 'utf8');
    } catch (cause) {
        if (isMissingFile(cause)) {
            return null;
        }
        throw cause;
    }
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        return null;
    }
    return isJournalDocument(value, runId) ? value : null;
}

export function executionJournalPath(agentRoot: string, runId: string): string {
    if (!isExecutionJournalRunId(runId)) {
        throw new Error('The execution journal run id is invalid.');
    }
    return join(journalDirectoryPath(agentRoot), `${runId}.json`);
}

export function isExecutionJournalRunId(runId: string): boolean {
    return runIdPattern.test(runId);
}

function journalDirectoryPath(agentRoot: string) {
    return join(agentRoot, 'runtime', journalDirectory);
}
