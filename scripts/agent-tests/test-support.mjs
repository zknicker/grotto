/** The body a Server sends when the tRPC path itself is not routed. */
export function unroutedPathError(path) {
    return trpcError(path, 404, `No "query"-procedure on path "${path}"`);
}

/** The body an authorization or unknown-Agent refusal sends: also NOT_FOUND. */
export function deniedError(path) {
    return trpcError(path, 404, 'No Agent exists on this Server.');
}

function trpcError(path, status, message) {
    const payload = {
        error: { code: -32_004, data: { code: 'NOT_FOUND', httpStatus: status, path }, message },
    };
    return new Error(`${path} failed (${status}): ${JSON.stringify(payload)}`);
}

/**
 * Runs `operation` with an Agent temporarily configured onto `target`'s
 * runtime/model, restoring the Agent's own configuration afterwards even when
 * the operation throws.
 */
export async function withTemporaryAgentConfiguration(harness, agent, target, operation, log) {
    const original = {
        modelId: agent.desiredModelId,
        runtimeId: agent.desiredRuntimeId,
    };
    const changed = original.modelId !== target.modelId || original.runtimeId !== target.runtimeId;
    let configured = false;

    try {
        if (changed) {
            configured = true;
            log?.('configuring the Agent on the requested temporary runtime/model');
            await harness.configureAgent(agent, target.runtimeId, target.modelId);
        }
        return await operation();
    } finally {
        if (configured) {
            log?.('restoring the Agent’s original runtime/model');
            await harness.configureAgent(agent, original.runtimeId, original.modelId);
        }
    }
}
