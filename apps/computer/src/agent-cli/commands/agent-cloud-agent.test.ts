import { expect, test } from 'bun:test';
import type { AgentApiRequest, AgentApiRequester } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import type { ParsedArgs } from '../parse.ts';
import { runCloudAgentCancel, runCloudAgentStart } from './agent-cloud-agent.ts';

const work = {
    activity: null,
    agentId: 'agt_orbit',
    cancelRequestedAt: null,
    cancelRequestedBy: null,
    chatId: 'cht_product',
    computerId: 'cmp_studio',
    createdAt: '2026-09-04T12:00:00.000Z',
    id: 'caw_1234567890abcdef',
    messageId: 'msg_1a2b3c4d5e6f7890',
    provider: 'cursor',
    providerAgentId: null,
    providerUrl: null,
    repository: 'grotto/grotto',
    runs: [],
    startedAt: null,
    startingRef: 'main',
    status: 'queued',
    terminalAt: null,
    title: 'Fix the flaky delivery test',
    updatedAt: '2026-09-04T12:00:00.000Z',
};

function args(overrides: Record<string, string> = {}): ParsedArgs {
    return {
        flags: {},
        help: false,
        positionals: [],
        valueLists: {},
        values: {
            '--ref': 'main',
            '--repo': 'grotto/grotto',
            '--say': 'Handing the flaky delivery test to a cloud agent.',
            '--target': '#product',
            '--title': 'Fix the flaky delivery test',
            ...overrides,
        },
    };
}

function requester(seen: AgentApiRequest[], route: string[] = []): AgentApiRequester {
    return {
        request<T>(path: string, _schema: unknown, input?: AgentApiRequest) {
            route.push(path);
            seen.push(input ?? {});
            return Promise.resolve({
                chatId: 'cht_product',
                idempotent: false,
                messageId: work.messageId,
                runId: 'car_1234567890abcdef',
                sequence: 7,
                target: '#product',
                work,
            } as T);
        },
    };
}

test('starts one Cloud Agent with the stdin instructions and the Agent’s own words', async () => {
    const seen: AgentApiRequest[] = [];
    const routes: string[] = [];
    const output: string[] = [];

    const exitCode = await runCloudAgentStart(args(), {
        client: requester(seen, routes),
        mintNonce: () => 'cloud-agent-nonce',
        readStdin: () => Promise.resolve('Reproduce the flake and open a pull request.\n'),
        stdinIsTty: false,
        write: (text) => output.push(text),
    });

    expect(exitCode).toBe(0);
    expect(routes).toEqual(['/api/agent/cloud-agents']);
    expect(seen[0]?.body).toEqual({
        content: 'Handing the flaky delivery test to a cloud agent.',
        instructions: 'Reproduce the flake and open a pull request.',
        nonce: 'cloud-agent-nonce',
        repository: 'grotto/grotto',
        startingRef: 'main',
        target: '#product',
        title: 'Fix the flaky delivery test',
    });
    const printed = output.join('');
    expect(printed).toContain('Work ID: caw_1234567890abcdef');
    expect(printed).toContain('target "#product:1a2b3c4d"');
    expect(printed).toContain('reaches your inbox');
});

test('a start with no instructions, a bad repository, or no ref fails or omits truthfully', async () => {
    const deps = {
        client: requester([]),
        mintNonce: () => 'cloud-agent-nonce',
        readStdin: () => Promise.resolve('   '),
        stdinIsTty: false,
        write: () => undefined,
    };
    await expect(runCloudAgentStart(args(), deps)).rejects.toThrow(AgentCliError);

    const seen: AgentApiRequest[] = [];
    await expect(
        runCloudAgentStart(args({ '--repo': 'grotto' }), {
            ...deps,
            client: requester(seen),
            readStdin: () => Promise.resolve('Do the work.'),
        })
    ).rejects.toThrow(/Invalid repository/);
    expect(seen).toHaveLength(0);

    const withoutRef: ParsedArgs = args();
    withoutRef.values['--ref'] = '';
    await runCloudAgentStart(withoutRef, {
        ...deps,
        client: requester(seen),
        readStdin: () => Promise.resolve('Do the work.'),
    });
    expect((seen[0]?.body as { startingRef: string | null }).startingRef).toBeNull();
});

test('cancel names the work it asked the provider to stop', async () => {
    const routes: string[] = [];
    const output: string[] = [];
    const exitCode = await runCloudAgentCancel(
        { flags: {}, help: false, positionals: [], valueLists: {}, values: { '--work': work.id } },
        {
            client: requester([], routes),
            mintNonce: () => 'unused',
            readStdin: () => Promise.resolve(''),
            stdinIsTty: true,
            write: (text) => output.push(text),
        }
    );

    expect(exitCode).toBe(0);
    expect(routes).toEqual(['/api/agent/cloud-agents/cancel']);
    expect(output.join('')).toContain('Cancel requested for Fix the flaky delivery test');
});
