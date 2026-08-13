import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
    ComputerExecutionJournal,
    ComputerExecutionJournalDocument,
    ComputerExecutionJournalStatus,
    ComputerExecutionJournalTool,
} from './execution-journal-types';
import { interruptTool, journalValue } from './execution-journal-values';

export class FileExecutionJournal implements ComputerExecutionJournal {
    private writeChain = Promise.resolve();

    constructor(
        readonly path: string,
        private readonly document: ComputerExecutionJournalDocument,
        private readonly now: () => Date
    ) {}

    async recordToolCall(input: {
        input?: unknown;
        nativeName?: string;
        occurredAt?: string;
        toolCallId: string;
        toolName: string;
    }): Promise<void> {
        if (!(input.toolCallId && input.toolName)) {
            return;
        }
        const occurredAt = input.occurredAt ?? this.now().toISOString();
        let tool = this.findTool(input.toolCallId);
        if (!tool) {
            tool = {
                startedAt: occurredAt,
                status: 'running',
                toolCallId: input.toolCallId,
                toolName: input.toolName,
            };
            this.document.tools.push(tool);
        } else if (tool.status === 'interrupted') {
            tool.status = 'running';
            tool.endedAt = undefined;
            tool.durationMs = undefined;
            tool.final = undefined;
            tool.output = undefined;
            tool.error = undefined;
        }
        tool.toolName = input.toolName;
        tool.nativeName ??= input.nativeName;
        if (input.input !== undefined) {
            tool.input = journalValue(input.input);
        }
        await this.persist();
    }

    async recordToolResult(input: {
        isError: boolean;
        nativeName?: string;
        occurredAt?: string;
        preliminary: boolean;
        result?: unknown;
        toolCallId: string;
        toolName: string;
    }): Promise<void> {
        if (!(input.toolCallId && input.toolName)) {
            return;
        }
        const occurredAt = input.occurredAt ?? this.now().toISOString();
        const tool = this.findOrCreateTool(input.toolCallId, input.toolName, occurredAt);
        if (tool.final) {
            return;
        }
        tool.toolName = input.toolName;
        tool.nativeName ??= input.nativeName;
        const result = input.isError
            ? { error: journalValue(input.result), observedAt: occurredAt }
            : { observedAt: occurredAt, output: journalValue(input.result) };
        if (input.preliminary) {
            tool.preliminary = result;
            this.setLatestValue(tool, result);
        } else {
            tool.final = result;
            tool.status = input.isError ? 'failed' : 'completed';
            tool.endedAt = occurredAt;
            tool.durationMs = Math.max(0, Date.parse(occurredAt) - Date.parse(tool.startedAt));
            this.setLatestValue(tool, result);
        }
        await this.persist();
    }

    async finishPending(
        status: Exclude<ComputerExecutionJournalStatus, 'completed' | 'running'>,
        reason: 'stream_abort' | 'stream_error',
        error?: unknown
    ): Promise<void> {
        const at = this.now();
        let changed = false;
        for (const tool of this.document.tools) {
            if (tool.status !== 'running') {
                continue;
            }
            if (status === 'interrupted') {
                interruptTool(tool, at, reason);
            } else {
                tool.status = 'failed';
                tool.endedAt = at.toISOString();
                tool.durationMs = Math.max(0, at.getTime() - Date.parse(tool.startedAt));
                tool.error = journalValue(error ?? { code: 'stream_failed' });
                tool.final = { error: tool.error, observedAt: tool.endedAt };
            }
            changed = true;
        }
        if (changed) {
            await this.persist();
        }
    }

    async finish(status: Exclude<ComputerExecutionJournalStatus, 'running'>, error?: unknown) {
        const at = this.now();
        for (const tool of this.document.tools) {
            if (tool.status !== 'running') {
                continue;
            }
            tool.status = status === 'completed' ? 'failed' : status;
            tool.endedAt = at.toISOString();
            tool.durationMs = Math.max(0, at.getTime() - Date.parse(tool.startedAt));
            if (status === 'completed') {
                tool.error = { code: 'missing_result' };
                tool.final = { error: tool.error, observedAt: tool.endedAt };
            } else {
                tool.error = journalValue(error ?? { code: status });
            }
        }
        this.document.status = status;
        this.document.endedAt = at.toISOString();
        if (error !== undefined) {
            this.document.error = journalValue(error);
        } else {
            this.document.error = undefined;
        }
        await this.persist();
    }

    snapshot(): ComputerExecutionJournalDocument {
        return structuredClone(this.document);
    }

    async persist(): Promise<void> {
        const serialized = JSON.stringify(this.document);
        const write = this.writeChain.then(async () => {
            await mkdir(dirname(this.path), { mode: 0o700, recursive: true });
            const temporary = `${this.path}.tmp`;
            await writeFile(temporary, serialized, { encoding: 'utf8', mode: 0o600 });
            await rename(temporary, this.path);
        });
        this.writeChain = write.catch(() => undefined);
        return write;
    }

    private findTool(toolCallId: string) {
        return this.document.tools.find((candidate) => candidate.toolCallId === toolCallId);
    }

    private findOrCreateTool(toolCallId: string, toolName: string, startedAt: string) {
        const existing = this.findTool(toolCallId);
        if (existing) {
            return existing;
        }
        const tool: ComputerExecutionJournalTool = {
            startedAt,
            status: 'running',
            toolCallId,
            toolName,
        };
        this.document.tools.push(tool);
        return tool;
    }

    private setLatestValue(
        tool: ComputerExecutionJournalTool,
        result:
            | { error: ReturnType<typeof journalValue>; observedAt: string }
            | {
                  observedAt: string;
                  output: ReturnType<typeof journalValue>;
              }
    ) {
        if ('error' in result) {
            tool.error = result.error;
        } else {
            tool.output = result.output;
        }
    }
}
