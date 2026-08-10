export class AttachmentWriteCoordinator {
    private readonly active = new Map<string, number>();
    private readonly deleting = new Set<string>();
    private readonly exclusiveTails = new Map<string, Promise<void>>();
    private readonly quiescing = new Set<string>();
    private readonly waiters = new Map<string, Set<() => void>>();

    begin(serverId: string): () => void {
        if (this.deleting.has(serverId) || this.quiescing.has(serverId)) {
            throw new Error('This Server attachment root is being deleted.');
        }
        this.active.set(serverId, (this.active.get(serverId) ?? 0) + 1);
        let released = false;
        return () => {
            if (released) {
                return;
            }
            released = true;
            const remaining = (this.active.get(serverId) ?? 1) - 1;
            if (remaining > 0) {
                this.active.set(serverId, remaining);
                return;
            }
            this.active.delete(serverId);
            for (const resolve of this.waiters.get(serverId) ?? []) {
                resolve();
            }
            this.waiters.delete(serverId);
        };
    }

    async runExclusive<Result>(serverId: string, operation: () => Promise<Result>) {
        if (this.deleting.has(serverId)) {
            throw new Error('This Server attachment root is being deleted.');
        }
        return await this.enqueueExclusive(serverId, operation);
    }

    async runPermanentlyExclusive<Result>(serverId: string, operation: () => Promise<Result>) {
        this.deleting.add(serverId);
        return await this.enqueueExclusive(serverId, operation);
    }

    private async enqueueExclusive<Result>(serverId: string, operation: () => Promise<Result>) {
        const predecessor = this.exclusiveTails.get(serverId) ?? Promise.resolve();
        const result = predecessor
            .catch(() => undefined)
            .then(async () => {
                this.quiescing.add(serverId);
                try {
                    await this.waitForActive(serverId);
                    return await operation();
                } finally {
                    this.quiescing.delete(serverId);
                }
            });
        const tail = result.then(
            () => undefined,
            () => undefined
        );
        this.exclusiveTails.set(serverId, tail);
        try {
            return await result;
        } finally {
            if (this.exclusiveTails.get(serverId) === tail) {
                this.exclusiveTails.delete(serverId);
            }
        }
    }

    private async waitForActive(serverId: string) {
        if (!this.active.has(serverId)) {
            return;
        }
        await new Promise<void>((resolve) => {
            const serverWaiters = this.waiters.get(serverId) ?? new Set();
            serverWaiters.add(resolve);
            this.waiters.set(serverId, serverWaiters);
        });
    }
}
