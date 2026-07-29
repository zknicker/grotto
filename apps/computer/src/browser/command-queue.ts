// One process-wide FIFO serializes all browser commands across agents and
// turns: agent-browser drives a single Chrome/CDP session that must never be
// raced. Active commands also inhibit automatic recovery.
export class BrowserCommandQueue {
    private tail: Promise<unknown> = Promise.resolve();
    private inFlight = 0;
    private drainWaiters: Array<() => void> = [];

    get inFlightCount(): number {
        return this.inFlight;
    }

    run<T>(command: () => Promise<T>): Promise<T> {
        this.inFlight += 1;
        const result = this.tail.then(command, command);
        this.tail = result.then(
            () => this.settle(),
            () => this.settle()
        );
        return result;
    }

    // Recovery waits a bounded period for active commands to finish before
    // restarting Chrome. Resolves false when commands are still running at
    // the deadline.
    waitForDrain(timeoutMs: number): Promise<boolean> {
        if (this.inFlight === 0) {
            return Promise.resolve(true);
        }
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.drainWaiters = this.drainWaiters.filter((waiter) => waiter !== onDrain);
                resolve(false);
            }, timeoutMs);
            const onDrain = () => {
                clearTimeout(timer);
                resolve(true);
            };
            this.drainWaiters.push(onDrain);
        });
    }

    private settle(): void {
        this.inFlight -= 1;
        if (this.inFlight === 0) {
            const waiters = this.drainWaiters;
            this.drainWaiters = [];
            for (const waiter of waiters) {
                waiter();
            }
        }
    }
}
