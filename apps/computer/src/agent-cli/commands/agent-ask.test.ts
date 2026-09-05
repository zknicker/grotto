import { expect, test } from 'bun:test';
import type { AgentApiRequest, AgentApiRequester } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import type { ParsedArgs } from '../parse.ts';
import { runAsk } from './agent-ask.ts';

const ask = {
    addresseeUserId: 'usr_ada',
    agentId: 'agt_orbit',
    answerMessageId: null,
    answeredAt: null,
    answeredBy: null,
    chatId: 'cht_product',
    createdAt: '2026-09-03T12:00:00.000Z',
    id: 'ask_1234567890abcdef',
    messageId: 'msg_1a2b3c4d5e6f7890',
    recommendedStep: 'Approve the staged migration',
    status: 'open',
    summary: 'The migration is staged and reversible for one hour.',
    title: 'Run the staged migration?',
};

function args(overrides: Record<string, string> = {}): ParsedArgs {
    return {
        flags: {},
        help: false,
        positionals: [],
        valueLists: {},
        values: {
            '--step': 'Approve the staged migration',
            '--summary': 'The migration is staged and reversible for one hour.',
            '--target': '#product',
            '--title': 'Run the staged migration?',
            '--to': '@Ada',
            ...overrides,
        },
    };
}

function requester(target: string, seen: AgentApiRequest[]): AgentApiRequester {
    return {
        request<T>(_route: string, _schema: unknown, input?: AgentApiRequest) {
            seen.push(input ?? {});
            return Promise.resolve({
                ask,
                chatId: 'cht_product',
                idempotent: false,
                messageId: ask.messageId,
                sequence: 7,
                target,
            } as T);
        },
    };
}

test('posts one Ask with the stdin question and teaches the answer Thread', async () => {
    const seen: AgentApiRequest[] = [];
    const output: string[] = [];

    const exitCode = await runAsk(args(), {
        client: requester('#product', seen),
        mintNonce: () => 'ask-test',
        readStdin: () => Promise.resolve('Should I run it now?\n\n'),
        stdinIsTty: false,
        write: (text) => output.push(text),
    });

    expect(exitCode).toBe(0);
    expect(seen[0]).toMatchObject({
        body: {
            addresseeHandle: 'ada',
            content: 'Should I run it now?',
            nonce: 'ask-test',
            recommendedStep: 'Approve the staged migration',
            summary: 'The migration is staged and reversible for one hour.',
            target: '#product',
            title: 'Run the staged migration?',
        },
        method: 'POST',
    });
    expect(output.join('')).toBe(
        'Ask sent to #product for @ada. Message ID: msg_1a2b3c4d5e6f7890\n' +
            '(the answer arrives in this message\'s thread, target "#product:1a2b3c4d")\n'
    );
});

test('an Ask inside a Thread points at that Thread instead of a new one', async () => {
    const output: string[] = [];

    await runAsk(args({ '--target': '#product:1a2b3c4d' }), {
        client: requester('#product:1a2b3c4d', []),
        mintNonce: () => 'ask-test',
        readStdin: () => Promise.resolve('Still blocked?'),
        stdinIsTty: false,
        write: (text) => output.push(text),
    });

    expect(output.join('')).toContain('(the answer arrives in "#product:1a2b3c4d")');
});

test('missing arguments, bad handles, and empty stdin fail before any request', async () => {
    const unreachable: AgentApiRequester = {
        request() {
            throw new Error('The Ask must not reach the Server.');
        },
    };
    const deps = {
        client: unreachable,
        mintNonce: () => 'ask-test',
        readStdin: () => Promise.resolve('Should I run it now?'),
        stdinIsTty: false,
        write: () => undefined,
    };

    await expect(runAsk(args({ '--to': '' }), deps)).rejects.toThrow(AgentCliError);
    await expect(runAsk(args({ '--to': '@not a handle' }), deps)).rejects.toThrow(
        'Invalid handle "@not a handle".'
    );
    await expect(runAsk(args({ '--title': '' }), deps)).rejects.toThrow('--title is required.');
    await expect(runAsk(args({ '--step': '' }), deps)).rejects.toThrow('--step is required.');
    await expect(runAsk(args({ '--target': 'product' }), deps)).rejects.toThrow(
        'Invalid target "product".'
    );
    await expect(
        runAsk(args(), { ...deps, readStdin: () => Promise.resolve('   ') })
    ).rejects.toThrow('The question text is required on stdin.');
    await expect(runAsk(args(), { ...deps, stdinIsTty: true })).rejects.toThrow(
        'The question text is required on stdin.'
    );
});
