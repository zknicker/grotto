/**
 * Event-driven waiters for mutations that must not change an Agent's local
 * files while its current turn is running.
 */
export class AgentRunSettlements {
    private readonly waiters = new Map<string, Set<() => void>>();

    constructor(private readonly agentRuns: ReadonlyMap<string, string>) {}

    wait(agentId: string): Promise<void> {
        if (!this.agentRuns.has(agentId)) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const waiters = this.waiters.get(agentId) ?? new Set();
            waiters.add(resolve);
            this.waiters.set(agentId, waiters);
        });
    }

    released(agentId: string): void {
        if (this.agentRuns.has(agentId)) {
            return;
        }
        const waiters = this.waiters.get(agentId);
        this.waiters.delete(agentId);
        for (const resolve of waiters ?? []) {
            resolve();
        }
    }
}
