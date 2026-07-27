import * as z from 'zod';
import type { AgentApiRequest, AgentApiRequester } from './agent-api-client.ts';
import { AgentCliError } from './agent-error.ts';

const MAX_TASK_FRAME_BYTES = 1024 * 1024;

export interface ManagedTaskPeer {
    closeInput(): Promise<void>;
    stderr: AsyncIterable<Uint8Array>;
    stdout: AsyncIterable<Uint8Array>;
    terminate(): Promise<void>;
    write(frame: string): Promise<void>;
}

const taskResultFrameSchema = z
    .object({
        id: z.string().min(1),
        result: z.unknown(),
        type: z.literal('task.result'),
    })
    .strict();
const taskErrorFrameSchema = z
    .object({
        error: z
            .object({
                code: z.string().min(1),
                message: z.string().min(1),
                nextAction: z.string().min(1).optional(),
            })
            .strict(),
        id: z.string().min(1),
        type: z.literal('task.error'),
    })
    .strict();

export class ManagedTaskPeerClient implements AgentApiRequester {
    constructor(
        private readonly openPeer: () => ManagedTaskPeer,
        private readonly mintRequestId: () => string = () => crypto.randomUUID()
    ) {}

    async request<T>(route: string, schema: z.ZodType<T>, input: AgentApiRequest = {}): Promise<T> {
        const request = resolveTaskRequest(route, input);
        const requestId = this.mintRequestId();
        const { signal } = input;
        let peer: ManagedTaskPeer | undefined;

        try {
            peer = this.openPeer();
            void drain(peer.stderr).catch(() => undefined);
            throwIfCancelled(signal);
            await interruptible(
                peer.write(
                    `${JSON.stringify({
                        id: requestId,
                        input: request.input,
                        type: 'task.request',
                        verb: request.verb,
                    })}\n`
                ),
                signal
            );
            throwIfCancelled(signal);
            await interruptible(peer.closeInput(), signal);
            const payload = parseFrame(
                await collectText(peer.stdout, signal, MAX_TASK_FRAME_BYTES)
            );
            const errorFrame = taskErrorFrameSchema.safeParse(payload);
            if (errorFrame.success) {
                if (errorFrame.data.id !== requestId) {
                    throw protocolError();
                }
                throw new AgentCliError(errorFrame.data.error.code, errorFrame.data.error.message, {
                    nextAction: errorFrame.data.error.nextAction,
                });
            }
            const frame = taskResultFrameSchema.safeParse(payload);
            if (!(frame.success && frame.data.id === requestId)) {
                throw protocolError();
            }
            const result = schema.safeParse(frame.data.result);
            if (!result.success) {
                throw protocolError();
            }
            return result.data;
        } catch (error) {
            if (error instanceof AgentCliError) {
                throw error;
            }
            throw peerIoError();
        } finally {
            await peer?.terminate().catch(() => undefined);
        }
    }
}

async function drain(stream: AsyncIterable<Uint8Array>): Promise<void> {
    for await (const _chunk of stream) {
        // Drain diagnostics independently so they cannot block or corrupt stdout framing.
    }
}

async function collectText(
    stream: AsyncIterable<Uint8Array>,
    signal?: AbortSignal,
    maxBytes = Number.POSITIVE_INFINITY
): Promise<string> {
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    const iterator = stream[Symbol.asyncIterator]();
    try {
        while (true) {
            const next = await nextChunk(iterator, signal);
            if (next.done) {
                return text + decoder.decode();
            }
            bytes += next.value.byteLength;
            if (bytes > maxBytes) {
                throw protocolError();
            }
            text += decoder.decode(next.value, { stream: true });
        }
    } finally {
        if (signal?.aborted) {
            void Promise.resolve(iterator.return?.()).catch(() => undefined);
        }
    }
}

function parseFrame(text: string): unknown {
    const lines = text.split('\n');
    if (lines.at(-1) !== '') {
        throw protocolError();
    }
    const frames = lines.slice(0, -1).filter((line) => line.trim().length > 0);
    if (frames.length !== 1) {
        throw protocolError();
    }
    try {
        return JSON.parse(frames[0] as string);
    } catch {
        throw protocolError();
    }
}

function protocolError() {
    return new AgentCliError(
        'TASK_PEER_PROTOCOL_ERROR',
        'The managed task peer returned an invalid response.',
        { nextAction: 'Retry the task command after the managed runner is healthy.' }
    );
}

function cancelledError() {
    return new AgentCliError('TASK_PEER_CANCELLED', 'The managed task command was cancelled.');
}

function peerIoError() {
    return new AgentCliError(
        'TASK_PEER_IO_ERROR',
        'The managed task peer could not complete the command.',
        { nextAction: 'Retry the task command after the managed runner is healthy.' }
    );
}

function resolveTaskRequest(
    route: string,
    input: AgentApiRequest
): {
    input: Omit<AgentApiRequest, 'signal'>;
    verb: 'list' | 'create' | 'claim' | 'unclaim' | 'update';
} {
    const url = new URL(route, 'http://managed-task-peer');
    const method = input.method ?? 'GET';
    const key = `${method} ${url.pathname}`;
    const verb = {
        'GET /api/agent/tasks': 'list',
        'POST /api/agent/tasks/claim': 'claim',
        'POST /api/agent/tasks/create': 'create',
        'POST /api/agent/tasks/unclaim': 'unclaim',
        'POST /api/agent/tasks/update': 'update',
    }[key] as 'list' | 'create' | 'claim' | 'unclaim' | 'update' | undefined;
    if (!verb) {
        throw new AgentCliError('INVALID_ARG', 'The managed task peer only accepts task verbs.');
    }
    const routeQuery = Object.fromEntries(url.searchParams);
    const { signal: _signal, ...wireInput } = input;
    return {
        input: {
            ...wireInput,
            ...(Object.keys(routeQuery).length > 0
                ? { query: { ...routeQuery, ...wireInput.query } }
                : {}),
        },
        verb,
    };
}

function throwIfCancelled(signal?: AbortSignal) {
    if (signal?.aborted) {
        throw cancelledError();
    }
}

async function interruptible<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
    throwIfCancelled(signal);
    if (!signal) {
        return await operation;
    }
    return await new Promise((resolve, reject) => {
        const onAbort = () => reject(cancelledError());
        signal.addEventListener('abort', onAbort, { once: true });
        operation.then(resolve, reject).finally(() => {
            signal.removeEventListener('abort', onAbort);
        });
    });
}

async function nextChunk(
    iterator: AsyncIterator<Uint8Array>,
    signal?: AbortSignal
): Promise<IteratorResult<Uint8Array>> {
    throwIfCancelled(signal);
    if (!signal) {
        return await iterator.next();
    }
    return await new Promise((resolve, reject) => {
        const onAbort = () => reject(cancelledError());
        signal.addEventListener('abort', onAbort, { once: true });
        iterator
            .next()
            .then(resolve, reject)
            .finally(() => {
                signal.removeEventListener('abort', onAbort);
            });
    });
}
