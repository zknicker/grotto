import { describe, expect, test, vi } from 'vitest';
import * as z from 'zod';
import { type ManagedTaskPeer, ManagedTaskPeerClient } from './managed-task-peer-client.ts';

describe('ManagedTaskPeerClient', () => {
    test('writes one task request and parses a response split across stdout chunks', async () => {
        const peer = scriptedPeer([
            '{"id":"req_1","result":{"tasks":',
            '[{"number":7}]},"type":"task.result"}\n',
        ]);
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request(
                '/api/agent/tasks?status=todo',
                z.object({ tasks: z.array(z.object({ number: z.number() })) }),
                { method: 'GET' }
            )
        ).resolves.toEqual({ tasks: [{ number: 7 }] });
        expect(peer.write).toHaveBeenCalledWith(
            '{"id":"req_1","input":{"method":"GET","query":{"status":"todo"}},"type":"task.request","verb":"list"}\n'
        );
        expect(peer.closeInput).toHaveBeenCalledOnce();
        expect(peer.terminate).toHaveBeenCalledOnce();
    });

    test('surfaces a task protocol error without treating it as malformed JSON', async () => {
        const peer = scriptedPeer([
            '{"error":{"code":"TASK_ALREADY_CLAIMED","message":"Task #7 is owned by @finch.",',
            '"nextAction":"Choose another task."},"id":"req_1","type":"task.error"}\n',
        ]);
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request('/api/agent/tasks/claim', z.unknown(), {
                body: { numbers: [7], target: '#general' },
                method: 'POST',
            })
        ).rejects.toMatchObject({
            code: 'TASK_ALREADY_CLAIMED',
            message: 'Task #7 is owned by @finch.',
            options: { nextAction: 'Choose another task.' },
        });
        expect(peer.terminate).toHaveBeenCalledOnce();
    });

    test.each([
        ['malformed JSON', ['{"id":\n']],
        ['an incomplete final frame', ['{"id":"req_1"']],
        [
            'more than one response frame',
            [
                '{"id":"req_1","result":{},"type":"task.result"}\n',
                '{"id":"req_1","result":{},"type":"task.result"}\n',
            ],
        ],
        [
            'an unknown protocol field',
            ['{"extra":true,"id":"req_1","result":{},"type":"task.result"}\n'],
        ],
    ])('rejects %s and still terminates the peer', async (_case, stdoutChunks) => {
        const peer = scriptedPeer(stdoutChunks);
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request('/api/agent/tasks', z.object({}), { method: 'GET' })
        ).rejects.toMatchObject({ code: 'TASK_PEER_PROTOCOL_ERROR' });
        expect(peer.terminate).toHaveBeenCalledOnce();
    });

    test('cancels and terminates the peer when the command signal aborts', async () => {
        const controller = new AbortController();
        const peer = scriptedPeer([]);
        const closeStdout = vi.fn(async () => ({
            done: true as const,
            value: undefined,
        }));
        peer.stdout = {
            [Symbol.asyncIterator]() {
                return {
                    next: () => {
                        controller.abort();
                        return new Promise<IteratorResult<Uint8Array>>(() => undefined);
                    },
                    return: closeStdout,
                };
            },
        };
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request('/api/agent/tasks', z.object({}), {
                method: 'GET',
                signal: controller.signal,
            })
        ).rejects.toMatchObject({ code: 'TASK_PEER_CANCELLED' });
        expect(peer.closeInput).toHaveBeenCalledOnce();
        expect(closeStdout).toHaveBeenCalledOnce();
        expect(peer.terminate).toHaveBeenCalledOnce();
    });

    test('does not await a hung async-generator return while cancelling', async () => {
        const controller = new AbortController();
        const peer = scriptedPeer([]);
        peer.stdout = hungChunks(controller);
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request('/api/agent/tasks', z.object({}), {
                method: 'GET',
                signal: controller.signal,
            })
        ).rejects.toMatchObject({ code: 'TASK_PEER_CANCELLED' });
        expect(peer.terminate).toHaveBeenCalledOnce();
    });

    test('does not wait for peer diagnostics to close after a result', async () => {
        const peer = scriptedPeer(['{"id":"req_1","result":{},"type":"task.result"}\n']);
        peer.stderr = neverEndingChunks();
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request('/api/agent/tasks', z.object({}), { method: 'GET' })
        ).resolves.toEqual({});
        expect(peer.terminate).toHaveBeenCalledOnce();
    });

    test('preserves a protocol error when peer termination also fails', async () => {
        const peer = scriptedPeer(['not-json\n']);
        peer.terminate.mockRejectedValue(new Error('terminate failed'));
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request('/api/agent/tasks', z.object({}), { method: 'GET' })
        ).rejects.toMatchObject({ code: 'TASK_PEER_PROTOCOL_ERROR' });
    });

    test('keeps peer diagnostics on stderr out of the stdout protocol frame', async () => {
        const peer = scriptedPeer(
            ['{"id":"req_1","result":{"tasks":[]},"type":"task.result"}\n'],
            ['peer diagnostic\n']
        );
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request('/api/agent/tasks', z.object({ tasks: z.array(z.unknown()) }), {
                method: 'GET',
            })
        ).resolves.toEqual({ tasks: [] });
    });

    test('maps peer I/O failure to a stable error and still cleans up', async () => {
        const peer = scriptedPeer([]);
        peer.write.mockRejectedValue(new Error('broken pipe'));
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request('/api/agent/tasks', z.unknown(), { method: 'GET' })
        ).rejects.toMatchObject({ code: 'TASK_PEER_IO_ERROR' });
        expect(peer.terminate).toHaveBeenCalledOnce();
    });

    test('maps peer startup failure to the stable I/O error', async () => {
        const client = new ManagedTaskPeerClient(() => {
            throw new Error('runner unavailable');
        });

        await expect(
            client.request('/api/agent/tasks', z.unknown(), { method: 'GET' })
        ).rejects.toMatchObject({ code: 'TASK_PEER_IO_ERROR' });
    });

    test.each([
        'write',
        'closeInput',
    ] as const)('cancels and terminates while peer %s is stalled', async (operation) => {
        const controller = new AbortController();
        const peer = scriptedPeer([]);
        peer[operation].mockImplementation(async () => {
            queueMicrotask(() => controller.abort());
            await new Promise<never>(() => undefined);
        });
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request('/api/agent/tasks', z.unknown(), {
                method: 'GET',
                signal: controller.signal,
            })
        ).rejects.toMatchObject({ code: 'TASK_PEER_CANCELLED' });
        expect(peer.terminate).toHaveBeenCalledOnce();
    });

    test.each([
        ['/api/agent/tasks', 'GET', 'list'],
        ['/api/agent/tasks/create', 'POST', 'create'],
        ['/api/agent/tasks/claim', 'POST', 'claim'],
        ['/api/agent/tasks/unclaim', 'POST', 'unclaim'],
        ['/api/agent/tasks/update', 'POST', 'update'],
    ] as const)('maps %s to the concrete %s task frame', async (route, method, verb) => {
        const peer = scriptedPeer(['{"id":"req_1","result":{},"type":"task.result"}\n']);
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await client.request(route, z.object({}), { method });
        expect(peer.write).toHaveBeenCalledWith(expect.stringContaining(`"verb":"${verb}"`));
    });

    test('rejects a non-task route before opening a peer', async () => {
        const openPeer = vi.fn(() => scriptedPeer([]));
        const client = new ManagedTaskPeerClient(openPeer, () => 'req_1');

        await expect(
            client.request('/api/agent/messages/send', z.unknown(), { method: 'POST' })
        ).rejects.toMatchObject({ code: 'INVALID_ARG' });
        expect(openPeer).not.toHaveBeenCalled();
    });

    test('rejects an oversized stdout frame and terminates the peer', async () => {
        const peer = scriptedPeer([
            `{"id":"req_1","result":"${'x'.repeat(1_048_576)}","type":"task.result"}\n`,
        ]);
        const client = new ManagedTaskPeerClient(
            () => peer,
            () => 'req_1'
        );

        await expect(
            client.request('/api/agent/tasks', z.unknown(), { method: 'GET' })
        ).rejects.toMatchObject({ code: 'TASK_PEER_PROTOCOL_ERROR' });
        expect(peer.terminate).toHaveBeenCalledOnce();
    });
});

function scriptedPeer(
    stdoutChunks: string[],
    stderrChunks: string[] = []
): ManagedTaskPeer & {
    closeInput: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
} {
    return {
        closeInput: vi.fn(async () => undefined),
        stderr: chunks(stderrChunks),
        stdout: chunks(stdoutChunks),
        terminate: vi.fn(async () => undefined),
        write: vi.fn(async () => undefined),
    };
}

async function* chunks(values: string[]) {
    for (const value of values) {
        yield new TextEncoder().encode(value);
    }
}

async function* hungChunks(controller: AbortController) {
    controller.abort();
    await new Promise<never>(() => undefined);
}

async function* neverEndingChunks() {
    await new Promise<never>(() => undefined);
}
