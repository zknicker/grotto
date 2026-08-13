import { expect, test } from 'bun:test';
import type * as z from 'zod';
import type { AgentApiRequester } from '../agent-api-client.ts';
import type { ParsedArgs } from '../parse.ts';
import { runTaskClaim } from './agent-task-actions.ts';

test('a claim directs updates to the Task Thread without rerouting replies', async () => {
    const outputs: string[] = [];
    const client: AgentApiRequester = {
        request: async <T>(_route: string, schema: z.ZodType<T>) =>
            schema.parse({
                claimed: [
                    {
                        assignee: null,
                        message: {
                            attachments: [],
                            author: {
                                id: 'usr_wren',
                                kind: 'user',
                                label: 'wren',
                                metadata: {},
                            },
                            chat_id: 'cht_general',
                            content: 'Audit the Server export',
                            created_at: '2026-07-26T20:00:00.000Z',
                            deleted_at: null,
                            delivery_id: null,
                            id: 'msg_1a2b3c4d00000000',
                            metadata: {},
                            nonce: 'task-cli-test',
                            role: 'user',
                            sender: {
                                description: null,
                                handle: 'wren',
                                type: 'human',
                            },
                            sequence: 1,
                        },
                        number: 7,
                        status: 'in_progress',
                        target: '#general',
                    },
                ],
            }) as T,
    };
    const args: ParsedArgs = {
        flags: {},
        help: false,
        positionals: [],
        valueLists: { '--number': ['7'] },
        values: { '--target': '#general' },
    };

    await runTaskClaim(args, {
        client,
        mintNonce: () => 'nonce',
        readStdin: async () => '',
        stdinIsTty: () => false,
        write: (text) => outputs.push(text),
    });

    expect(outputs.join('')).toContain('Work it in thread target "#general:1a2b3c4d".');
    expect(outputs.join('')).not.toContain('post the final result there');
});
