import { describe, expect, test } from 'bun:test';
import { watchGrottoSession } from './grotto-session-refresh.ts';

/**
 * A tRPC WebSocket keeps the Clerk session it was opened with, so an
 * authenticated subscription would keep presenting an expiring token. The App
 * reconnects when Clerk hands out a new one; the socket then re-reads its
 * connection params.
 */
describe('watchGrottoSession', () => {
    test('reconnects only when the Clerk session token changes', async () => {
        const watch = startWatch(['token-one', 'token-two', 'token-two', 'token-three']);

        await watch.ready();
        expect(watch.reconnects).toBe(0);

        await watch.tick();
        expect(watch.reconnects).toBe(1);

        await watch.tick();
        expect(watch.reconnects).toBe(1);

        await watch.tick();
        expect(watch.reconnects).toBe(2);

        watch.stop();
    });

    test('does not reconnect while the human is signed out', async () => {
        const watch = startWatch([null, null]);

        await watch.ready();
        await watch.tick();

        expect(watch.reconnects).toBe(0);
        watch.stop();
    });

    test('reconnects when the human signs out', async () => {
        const watch = startWatch(['token-one', null]);

        await watch.ready();
        expect(watch.reconnects).toBe(0);

        await watch.tick();
        expect(watch.reconnects).toBe(1);

        watch.stop();
    });

    test('reconnects when the human signs in later', async () => {
        const watch = startWatch([null, 'token-one']);

        await watch.ready();
        expect(watch.reconnects).toBe(0);

        await watch.tick();
        expect(watch.reconnects).toBe(1);

        watch.stop();
    });

    test('stops watching when torn down', async () => {
        const watch = startWatch(['token-one', 'token-two']);

        await watch.ready();
        watch.stop();
        await watch.tick();

        expect(watch.reconnects).toBe(0);
        expect(watch.isTimerCleared).toBe(true);
    });
});

function startWatch(tokens: (string | null)[]) {
    const queue = [...tokens];
    let handler: (() => void) | null = null;
    let cleared = false;
    let reconnects = 0;

    const stop = watchGrottoSession({
        clearTimer: () => {
            cleared = true;
            handler = null;
        },
        intervalMs: 1000,
        onStaleSession: () => {
            reconnects += 1;
        },
        readSessionToken: () => Promise.resolve(queue.shift() ?? null),
        startTimer: (run) => {
            handler = run;
            return 1;
        },
    });

    return {
        get isTimerCleared() {
            return cleared;
        },
        get reconnects() {
            return reconnects;
        },
        async ready() {
            await Bun.sleep(0);
        },
        stop,
        async tick() {
            handler?.();
            await Bun.sleep(0);
        },
    };
}
