import type {
    ComputerExecutionJournalDocument,
    ComputerExecutionJournalTool,
    JournalValue,
} from './execution-journal-types';

export function interruptTool(
    tool: ComputerExecutionJournalTool,
    now: Date,
    reason: 'computer_restart' | 'stream_abort' | 'stream_error'
) {
    tool.status = 'interrupted';
    tool.endedAt = now.toISOString();
    tool.durationMs = Math.max(0, now.getTime() - Date.parse(tool.startedAt));
    const interruptions = tool.interruptions ?? [];
    interruptions.push({ at: tool.endedAt, reason });
    tool.interruptions = interruptions;
}

export function journalValue(value: unknown, seen = new WeakSet<object>()): JournalValue {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : String(value);
    }
    if (typeof value === 'bigint') {
        return value.toString();
    }
    if (value instanceof Error) {
        return { message: value.message, name: value.name };
    }
    if (typeof value === 'undefined') {
        return null;
    }
    if (typeof value === 'object') {
        if (seen.has(value)) {
            return '[Circular]';
        }
        seen.add(value);
        if (Array.isArray(value)) {
            return value.map((item) => journalValue(item, seen));
        }
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, journalValue(item, seen)])
        );
    }
    return String(value);
}

export function isJournalDocument(
    value: unknown,
    runId: string
): value is ComputerExecutionJournalDocument {
    if (
        !isRecord(value) ||
        value.runId !== runId ||
        typeof value.startedAt !== 'string' ||
        !['completed', 'failed', 'interrupted', 'running'].includes(value.status as string) ||
        !Array.isArray(value.tools)
    ) {
        return false;
    }
    return value.tools.every(
        (tool) =>
            isRecord(tool) &&
            typeof tool.toolCallId === 'string' &&
            typeof tool.toolName === 'string' &&
            typeof tool.startedAt === 'string' &&
            ['completed', 'failed', 'interrupted', 'running'].includes(tool.status as string)
    );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function isMissingFile(error: unknown): boolean {
    return isRecord(error) && error.code === 'ENOENT';
}
