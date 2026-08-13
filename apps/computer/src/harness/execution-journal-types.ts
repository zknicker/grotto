export type JournalValue =
    | boolean
    | null
    | number
    | string
    | { [key: string]: JournalValue }
    | JournalValue[];

export type ComputerExecutionJournalStatus = 'completed' | 'failed' | 'interrupted' | 'running';

export interface ComputerExecutionJournalResult {
    error?: JournalValue;
    observedAt: string;
    output?: JournalValue;
}

export interface ComputerExecutionJournalTool {
    durationMs?: number;
    endedAt?: string;
    error?: JournalValue;
    final?: ComputerExecutionJournalResult;
    input?: JournalValue;
    interruptions?: Array<{
        at: string;
        reason: 'computer_restart' | 'stream_abort' | 'stream_error';
    }>;
    nativeName?: string;
    output?: JournalValue;
    preliminary?: ComputerExecutionJournalResult;
    startedAt: string;
    status: ComputerExecutionJournalStatus;
    toolCallId: string;
    toolName: string;
}

export interface ComputerExecutionJournalDocument {
    endedAt?: string;
    error?: JournalValue;
    runId: string;
    startedAt: string;
    status: ComputerExecutionJournalStatus;
    tools: ComputerExecutionJournalTool[];
}

export interface ComputerExecutionJournal {
    finish(
        status: Exclude<ComputerExecutionJournalStatus, 'running'>,
        error?: unknown
    ): Promise<void>;
    finishPending(
        status: Exclude<ComputerExecutionJournalStatus, 'completed' | 'running'>,
        reason: 'stream_abort' | 'stream_error',
        error?: unknown
    ): Promise<void>;
    readonly path: string;
    recordToolCall(input: {
        input?: unknown;
        nativeName?: string;
        occurredAt?: string;
        toolCallId: string;
        toolName: string;
    }): Promise<void>;
    recordToolResult(input: {
        isError: boolean;
        nativeName?: string;
        occurredAt?: string;
        preliminary: boolean;
        result?: unknown;
        toolCallId: string;
        toolName: string;
    }): Promise<void>;
    snapshot(): ComputerExecutionJournalDocument;
}
