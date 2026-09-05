import { expect, test } from 'bun:test';
import { AttachmentDaemonWork } from './attachment-daemon-work.ts';
import { makeDaemonRuntime } from './daemon-runtime.ts';

test('reconnect keeps run admission and routes completion through the current socket', async () => {
    const runtime = makeDaemonRuntime();
    const work = new AttachmentDaemonWork(runtime);
    const firstFrames: unknown[] = [];
    const secondFrames: unknown[] = [];
    const detachFirst = work.attachSender({
        send: (frame) => {
            firstFrames.push(frame);
            return true;
        },
    });
    expect(work.agentWork.reserve('agt_test', 'run_test').kind).toBe('reserved');

    detachFirst();
    work.attachSender({
        send: (frame) => {
            secondFrames.push(frame);
            return true;
        },
    });
    expect(work.agentWork.reserve('agt_test', 'run_test')).toEqual({ kind: 'duplicate' });
    expect(work.send({ runId: 'run_test', type: 'turn' })).toBe(true);
    expect(firstFrames).toEqual([]);
    expect(secondFrames).toEqual([{ runId: 'run_test', type: 'turn' }]);

    work.agentWork.release('agt_test', 'run_test');
    await work.close();
    await runtime.dispose();
});

test('terminal shutdown aborts active runs and waits for accepted writers', async () => {
    const runtime = makeDaemonRuntime();
    const work = new AttachmentDaemonWork(runtime);
    const reservation = work.agentWork.reserve('agt_test', 'run_test');
    const gate = Promise.withResolvers<void>();
    let settled = false;
    const writer = work.track(
        gate.promise.then(() => {
            settled = true;
        })
    );

    const closing = work.close();
    expect(reservation.kind).toBe('reserved');
    if (reservation.kind === 'reserved') {
        expect(reservation.controller.signal.aborted).toBe(true);
    }
    await Promise.resolve();
    expect(settled).toBe(false);
    gate.resolve();
    await Promise.all([writer, closing]);
    expect(settled).toBe(true);
    await runtime.dispose();
});
