import { expect, test } from 'bun:test';
import type { AgentApiRequest, AgentApiRequester } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import { type ParsedArgs, parseArgs, UsageError } from '../parse.ts';
import { ASK_COMMAND, runAsk } from './agent-ask.ts';

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
    options: ['Approve the staged migration', 'Wait for the release window'],
    status: 'open',
    summary: 'The migration is staged and reversible for one hour.',
    title: 'Run the staged migration?',
};

function args(
    overrides: Record<string, string> = {},
    options: string[] = ['Approve the staged migration', 'Wait for the release window']
): ParsedArgs {
    return {
        flags: {},
        help: false,
        positionals: [],
        valueLists: { '--option': options },
        values: {
            '--summary': 'The migration is staged and reversible for one hour.',
            '--target': '#product',
            '--title': 'Run the staged migration?',
            '--to': '@Ada',
            ...(options.at(-1) === undefined ? {} : { '--option': options.at(-1) as string }),
            ...overrides,
        },
    };
}

function openQuestionRequester(seen: AgentApiRequest[]): AgentApiRequester {
    return {
        request<T>(_route: string, _schema: unknown, input?: AgentApiRequest) {
            seen.push(input ?? {});
            return Promise.resolve({
                ask: { ...ask, options: [] },
                chatId: 'cht_product',
                idempotent: false,
                messageId: ask.messageId,
                sequence: 7,
                target: '#product',
            } as T);
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
            options: ['Approve the staged migration', 'Wait for the release window'],
            summary: 'The migration is staged and reversible for one hour.',
            target: '#product',
            title: 'Run the staged migration?',
        },
        method: 'POST',
    });
    expect(output.join('')).toBe(
        'Ask sent to #product for @ada. Message ID: msg_1a2b3c4d5e6f7890\n' +
            'Offered 2 options, recommending "Approve the staged migration".\n' +
            '(the answer arrives in this message\'s thread, target "#product:1a2b3c4d")\n'
    );
});

test('an Ask with no options is an open question, and the receipt says so', async () => {
    const seen: AgentApiRequest[] = [];
    const output: string[] = [];

    await runAsk(args({}, []), {
        client: openQuestionRequester(seen),
        mintNonce: () => 'ask-test',
        readStdin: () => Promise.resolve('Which one should I fix first?'),
        stdinIsTty: false,
        write: (text) => output.push(text),
    });

    expect(seen[0]).toMatchObject({ body: { options: [] } });
    expect(output.join('')).toContain('Offered no options; the human answers in their own words.');
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
    await expect(runAsk(args({}, ['']), deps)).rejects.toThrow(
        '--option needs text the human can send as a reply.'
    );
    await expect(runAsk(args({}, ['Yes', 'Yes']), deps)).rejects.toThrow(
        'Each --option must be distinct.'
    );
    await expect(runAsk(args({}, ['One', 'Two', 'Three', 'Four', 'Five']), deps)).rejects.toThrow(
        'At most 4 --option values are allowed; 5 were given.'
    );
    await expect(runAsk(args({}, ['a'.repeat(81)]), deps)).rejects.toThrow(
        '--option is at most 80 characters'
    );
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

// The CLI ships with Computer, so the retired flag is a clear error rather
// than a silently accepted alias.
test('--step is gone and says where the ways forward live now', () => {
    const spec = {
        examples: ASK_COMMAND.examples,
        flags: ASK_COMMAND.flags,
        name: 'ask',
        run: () => Promise.resolve(0),
        section: 'Status',
        summary: ASK_COMMAND.summary,
        usage: ASK_COMMAND.usage,
    };

    expect(() => parseArgs(spec, ['--step', 'Approve it'])).toThrow(UsageError);
    expect(() => parseArgs(spec, ['--step', 'Approve it'])).toThrow(
        '--step is gone. Offer replies with --option instead; the first one is your recommendation.'
    );
    expect(parseArgs(spec, ['--option', 'Yes', '--option', 'No']).valueLists?.['--option']).toEqual(
        ['Yes', 'No']
    );
});
