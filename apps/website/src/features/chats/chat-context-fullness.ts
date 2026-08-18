import type { TranscriptMessageRow, TranscriptRow } from './transcript-contract.ts';

export interface ContextWindowModel {
    contextWindow: number | null;
    modelId: string;
    provider: string;
}

export interface ChatContextFullness {
    contextWindow: number;
    percent: number;
    tokenCount: number;
}

export function getChatContextFullness(input: {
    models: readonly ContextWindowModel[];
    rows: readonly TranscriptRow[];
}): ChatContextFullness | null {
    const message = [...input.rows]
        .reverse()
        .find(
            (row): row is TranscriptMessageRow =>
                row.kind === 'message' && row.message.senderType === 'agent'
        )?.message;

    if (!message?.metadata) {
        return null;
    }

    const tokenCount =
        readTokenCount(message.metadata.totalTokens) ?? readUsageTokenCount(message.metadata.usage);
    const modelValue = message.metadata.model ?? message.metadata.agentModel;
    const providerValue = message.metadata.provider;

    if (!(tokenCount && typeof modelValue === 'string' && typeof providerValue === 'string')) {
        return null;
    }

    const contextWindow =
        input.models.find(
            (candidate) =>
                candidate.provider === providerValue &&
                normalizeModelId(candidate.modelId) === normalizeModelId(modelValue)
        )?.contextWindow ?? null;

    if (!contextWindow) {
        return null;
    }

    return {
        contextWindow,
        percent: Math.min(tokenCount / contextWindow, 1),
        tokenCount,
    };
}

function readUsageTokenCount(usage: unknown): number | null {
    if (!usage || typeof usage !== 'object') {
        return null;
    }

    const record = usage as Record<string, unknown>;

    return (
        readTokenCount(record.totalTokens) ??
        readTokenCount(record.total_tokens) ??
        readTokenCount(record.total) ??
        sumTokenCounts([
            record.input,
            record.input_tokens,
            record.output,
            record.output_tokens,
            record.cacheRead,
            record.cache_read_tokens,
            record.cacheWrite,
            record.cache_write_tokens,
        ])
    );
}

function readTokenCount(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function sumTokenCounts(values: unknown[]): number | null {
    const total = values.reduce<number>((sum, value) => sum + (readTokenCount(value) ?? 0), 0);
    return total > 0 ? total : null;
}

export function normalizeModelId(value: string) {
    return value.split('/').filter(Boolean).at(-1)?.trim() ?? value.trim();
}
