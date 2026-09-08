/**
 * Reading unknown tool payloads. Runtimes disagree on result shape, so every
 * reader here probes and degrades rather than trusting a contract.
 */

export interface TurnTraceShellOutput {
    readonly exitCode: number | null;
    readonly stderr: string | null;
    readonly stdout: string | null;
}

/** Best-effort text from an unknown tool result; callers degrade to JSON. */
export function readTraceText(value: unknown): string | null {
    if (typeof value === 'string') {
        return value.length > 0 ? value : null;
    }
    if (Array.isArray(value)) {
        const joined = value.map((entry) => readTraceText(entry)).filter(Boolean);
        return joined.length > 0 ? joined.join('\n') : null;
    }
    const record = readRecord(value);
    if (!record) {
        return null;
    }
    for (const key of ['output', 'text', 'stdout', 'content', 'message', 'result']) {
        const text = readTraceText(record[key]);
        if (text) {
            return text;
        }
    }
    return null;
}

/** Web results carry their citations inline; these become source pills. */
export function readTraceSources(value: unknown): Array<{ title: string; url: string }> {
    const entries = Array.isArray(value) ? value : readRecord(value)?.results;
    if (!Array.isArray(entries)) {
        return [];
    }
    const sources: Array<{ title: string; url: string }> = [];
    for (const entry of entries.slice(0, 12)) {
        const record = readRecord(entry);
        const url = readString(record?.url);
        if (url) {
            sources.push({ title: readString(record?.title) ?? readHostname(url), url });
        }
    }
    return sources;
}

export function readShellOutput(value: unknown): TurnTraceShellOutput {
    const record = readRecord(value);
    return {
        exitCode: typeof record?.exitCode === 'number' ? record.exitCode : null,
        stderr: readString(record?.stderr),
        stdout: readTraceText(value),
    };
}

/**
 * Tool payloads are model- and MCP-authored, so nothing bounds them. A single
 * unbroken 5 MB line beats the line-based collapse, and every tool body in a
 * trace mounts at once behind its disclosure, so the DOM cap is by character.
 */
export const traceTextMaxChars = 20_000;

export function clampTraceText(value: string): { clipped: boolean; text: string } {
    return value.length > traceTextMaxChars
        ? { clipped: true, text: value.slice(0, traceTextMaxChars) }
        : { clipped: false, text: value };
}

/** Keeps a payload small enough to hand a stock ChatTool block. */
export function clampTraceValue(value: unknown): unknown {
    const serialized = typeof value === 'string' ? value : stableJson(value);
    if (serialized === null || serialized.length <= traceTextMaxChars) {
        return value;
    }
    return `${serialized.slice(0, traceTextMaxChars)}\n… truncated`;
}

export function formatTraceValue(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    return stableJson(value) ?? String(value);
}

export function readHostname(url: string): string {
    try {
        return new URL(url).hostname || url;
    } catch {
        return url;
    }
}

export function readString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function readRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

export function stableJson(value: unknown): string | null {
    try {
        return JSON.stringify(value, null, 2) ?? null;
    } catch {
        return null;
    }
}
