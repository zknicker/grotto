import { createHash } from 'node:crypto';

function sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, child]) => [key, sortValue(child)])
        );
    }

    return value;
}

export function toCanonicalAgentRuntimeConfigJson(value: unknown) {
    return JSON.stringify(sortValue(value));
}

export function hashAgentRuntimeConfig(value: unknown) {
    return createHash('sha256').update(toCanonicalAgentRuntimeConfigJson(value)).digest('hex');
}
