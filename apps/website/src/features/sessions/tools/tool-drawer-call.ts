import { parseToolRecord } from './tool-detail-value.ts';

export interface ToolDrawerDetails {
    actions: Array<{
        kind: string;
        label?: string;
        sessionKey: string;
        subtitle?: string | null;
        title: string;
        tone?: 'amber' | 'neutral' | 'sky';
    }>;
    arguments: unknown;
    completedAt: string | null;
    result: unknown;
    startedAt: string | null;
    toolCall: {
        callId: string | null;
        facts: Array<{ label: string; tone: 'danger' | 'default' | 'success'; value: string }>;
        label: string | null;
        name: string;
        status: string | null;
        summaryParts: string[];
    };
}

/** Normalized tool call data shared by every drawer body renderer. */
export interface ToolDrawerCall {
    arguments: Record<string, unknown>;
    completedAt: string | null;
    durationMs: number | null;
    label: string | null;
    name: string;
    result: unknown;
    startedAt: string | null;
    status: string | null;
}

export function buildToolDrawerCall(details: ToolDrawerDetails): ToolDrawerCall {
    return {
        arguments: parseToolRecord(details.arguments) ?? {},
        completedAt: details.completedAt,
        durationMs: getToolCallDurationMs(details.startedAt, details.completedAt),
        label: details.toolCall.label,
        name: details.toolCall.name,
        result: details.result,
        startedAt: details.startedAt,
        status: details.toolCall.status,
    };
}

export function readToolCallString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/** Full result text for terminal/file renderers; never truncated. */
export function readToolResultText(result: unknown): string | null {
    if (typeof result === 'string') {
        return result.length > 0 ? result : null;
    }

    const record = parseToolRecord(result);

    if (!record) {
        return null;
    }

    for (const key of ['output', 'text', 'stdout', 'content', 'message']) {
        const value = record[key];

        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }

    return null;
}

function getToolCallDurationMs(startedAt: string | null, completedAt: string | null) {
    if (!(startedAt && completedAt)) {
        return null;
    }

    const startedAtValue = Date.parse(startedAt);
    const completedAtValue = Date.parse(completedAt);

    if (Number.isNaN(startedAtValue) || Number.isNaN(completedAtValue)) {
        return null;
    }

    return Math.max(0, completedAtValue - startedAtValue);
}
