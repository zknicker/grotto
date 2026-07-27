/**
 * Every Agent-configuration refusal — unknown Computer, an unreported runtime
 * or model, a cross-Computer reference, or missing authority — surfaces through
 * one error so the tRPC layer can map it to a single client-facing code.
 */
export class AgentConfigDeniedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AgentConfigDeniedError';
    }
}
