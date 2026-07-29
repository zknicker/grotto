export class AgentConfigurationQueue {
    private readonly pending = new Map<string, Promise<void>>();

    enqueue(agentId: string, operation: () => Promise<void>): Promise<void> {
        const predecessor = this.pending.get(agentId);
        const current = (predecessor?.catch(() => undefined) ?? Promise.resolve()).then(operation);
        this.pending.set(agentId, current);
        current.then(
            () => this.deleteIfCurrent(agentId, current),
            () => this.deleteIfCurrent(agentId, current)
        );
        return current;
    }

    wait(agentId: string): Promise<void> {
        return this.pending.get(agentId) ?? Promise.resolve();
    }

    private deleteIfCurrent(agentId: string, operation: Promise<void>): void {
        if (this.pending.get(agentId) === operation) {
            this.pending.delete(agentId);
        }
    }
}
