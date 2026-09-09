/**
 * Web reach is a product decision — Grotto serves web fetching through its own
 * `web_fetch` host tool, and builtin web search only when the Agent has web
 * access — but runtime builtin tool tables name their tools inconsistently:
 * Claude Code exposes `webSearch` beside `WebFetch`. A hardcoded deny name that
 * misses by a single letter case is rejected before the turn even starts, so
 * resolve what we disable against the names the runtime actually exposes.
 */

/** Logical web tools Grotto gates, in the casing product code talks about. */
export const webToolNames = {
    fetch: 'webFetch',
    search: 'webSearch',
} as const;

/** Agent settings that gate the builtin web tools of a runtime that has them. */
export function inactiveWebToolSettings(
    harness: { builtinTools: Readonly<Record<string, unknown>> },
    agent: { runtimeId: string; webAccess: string | null }
): { inactiveTools: string[] } | Record<string, never> {
    if (agent.runtimeId !== 'claude-code') {
        return {};
    }
    return {
        inactiveTools: resolveInactiveWebToolNames({
            exposedToolNames: Object.keys(harness.builtinTools),
            webAccess: agent.webAccess !== null,
        }),
    };
}

/**
 * Builtin tool names to disable for a turn. Web fetch is always off; web search
 * follows the Agent's web access. Names the runtime does not expose are dropped
 * rather than passed through, because naming an unknown tool fails the whole
 * turn; `runtime-web-tools.test.ts` fails when a real runtime stops exposing one.
 */
export function resolveInactiveWebToolNames(input: {
    exposedToolNames: readonly string[];
    webAccess: boolean;
}): string[] {
    return matchExposedToolNames({
        exposedToolNames: input.exposedToolNames,
        requestedToolNames: input.webAccess
            ? [webToolNames.fetch]
            : [webToolNames.fetch, webToolNames.search],
    });
}

/** Requested names resolved to their exposed spelling, ignoring case. */
export function matchExposedToolNames(input: {
    exposedToolNames: readonly string[];
    requestedToolNames: readonly string[];
}): string[] {
    const requested = new Set(input.requestedToolNames.map((name) => name.toLowerCase()));
    return input.exposedToolNames.filter((name) => requested.has(name.toLowerCase()));
}
