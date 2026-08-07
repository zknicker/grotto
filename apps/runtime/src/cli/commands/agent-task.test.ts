import { describe, expect, test, vi } from 'vitest';
import type { AgentApiRequester } from '../agent-api-client.ts';
import type { ParsedArgs } from '../parse.ts';
import {
    runTaskClaim,
    runTaskCreate,
    runTaskList,
    runTaskUnclaim,
    runTaskUpdate,
    TASK_SUBCOMMANDS,
} from './agent-task.ts';

const message = {
    attachments: [],
    author: {
        id: 'usr_wren',
        kind: 'user' as const,
        label: 'wren',
        metadata: {},
    },
    chat_id: 'cht_general',
    content: 'Audit the hosted export',
    created_at: '2026-07-26T20:00:00.000Z',
    deleted_at: null,
    delivery_id: null,
    id: 'msg_1a2b3c4d00000000',
    metadata: {},
    nonce: 'task-cli-test',
    role: 'user' as const,
    sender: {
        description: null,
        handle: 'wren',
        type: 'human' as const,
    },
    sequence: 1,
};
const task = {
    assignee: null,
    message,
    number: 7,
    status: 'todo' as const,
    target: '#general',
};

describe('managed task CLI contract', () => {
    test('keeps exactly the five landed task verbs', () => {
        expect(TASK_SUBCOMMANDS.map((command) => command.name)).toEqual([
            'list',
            'create',
            'claim',
            'unclaim',
            'update',
        ]);
    });

    test('maps each task verb to its stable request and canonical stdout', async () => {
        const request = vi.fn(async (route: string, _schema: unknown, _input?: unknown) => {
            if (route.endsWith('/create')) {
                return { tasks: [task] };
            }
            if (route.endsWith('/claim')) {
                return { claimed: [{ ...task, assignee: 'wren', status: 'in_progress' }] };
            }
            if (route.endsWith('/update')) {
                return { task: { ...task, status: 'done' } };
            }
            if (route.endsWith('/unclaim')) {
                return { task };
            }
            return { tasks: [task] };
        });
        const stdout: string[] = [];
        const deps = {
            client: { request: request as unknown as AgentApiRequester['request'] },
            readStdin: async () => 'Audit the hosted export\n',
            stdinIsTty: () => false,
            write: (text: string) => stdout.push(text),
        };

        await runTaskList(args({ values: {} }), deps);
        await runTaskCreate(args(), deps);
        await runTaskClaim(args({ valueLists: { '--number': ['7'] } }), deps);
        await runTaskUnclaim(args({ valueLists: { '--number': ['7'] } }), deps);
        await runTaskUpdate(
            args({
                valueLists: { '--number': ['7'] },
                values: { '--status': 'done', '--target': '#general' },
            }),
            deps
        );

        expect(request.mock.calls.map(([route]) => route)).toEqual([
            '/api/agent/tasks',
            '/api/agent/tasks/create',
            '/api/agent/tasks/claim',
            '/api/agent/tasks/unclaim',
            '/api/agent/tasks/update',
        ]);
        expect(request.mock.calls.map((call) => call[2])).toEqual([
            { method: 'GET' },
            {
                body: {
                    assignee: undefined,
                    content: 'Audit the hosted export',
                    target: '#general',
                    titles: undefined,
                },
                method: 'POST',
            },
            {
                body: { messageId: undefined, numbers: [7], target: '#general' },
                method: 'POST',
            },
            { body: { number: 7, target: '#general' }, method: 'POST' },
            {
                body: { number: 7, status: 'done', target: '#general' },
                method: 'POST',
            },
        ]);
        expect(stdout.join('')).toContain('#7 [todo]');
        expect(stdout.join('')).toContain('Created task #7');
        expect(stdout.join('')).toContain('Claimed task #7');
        expect(stdout.join('')).toContain(
            'Use thread target "#general:1a2b3c4d" for progress and execution discussion'
        );
        expect(stdout.join('')).toContain(
            'post the final result there unless a human explicitly requested another final-delivery target'
        );
        expect(stdout.join('')).toContain('Released task #7');
        expect(stdout.join('')).toContain('Task #7 is now [done]');
    });
});

function args(input: Partial<ParsedArgs> = {}): ParsedArgs {
    return {
        flags: {},
        help: false,
        positionals: [],
        valueLists: {},
        values: { '--target': '#general' },
        ...input,
    };
}
