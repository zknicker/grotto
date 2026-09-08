interface DrainWaiter {
    abort(): void;
    drain(): void;
}

// One coordinator FIFO serializes Browser commands. Active commands also
// inhibit automatic recovery.
export class BrowserCommandQueue {
    private tail: Promise<unknown> = Promise.resolve();
    private inFlight = 0;
    private readonly drainWaiters = new Set<DrainWaiter>();

    get inFlightCount(): number {
        return this.inFlight;
    }

    get drainWaiterCount(): number {
        return this.drainWaiters.size;
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

    waitForDrain(signal: AbortSignal): Promise<void> {
        if (this.inFlight === 0) {
            return Promise.resolve();
        }
        if (signal.aborted) {
            return Promise.reject(abortedDrainError());
        }
        return new Promise((resolve, reject) => {
            const remove = () => {
                signal.removeEventListener('abort', waiter.abort);
                this.drainWaiters.delete(waiter);
            };
            const waiter: DrainWaiter = {
                abort: () => {
                    remove();
                    reject(abortedDrainError());
                },
                drain: () => {
                    remove();
                    resolve();
                },
            };
            this.drainWaiters.add(waiter);
            signal.addEventListener('abort', waiter.abort, { once: true });
        });
    }

    private settle(): void {
        this.inFlight -= 1;
        if (this.inFlight !== 0) {
            return;
        }
        for (const waiter of [...this.drainWaiters]) {
            waiter.drain();
        }
    }
}

function abortedDrainError(): Error {
    return new Error('Browser command drain was cancelled.');
}
