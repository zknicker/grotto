import { expect, test } from 'bun:test';
import type * as z from 'zod';
import type { AgentApiRequester } from '../agent-api-client.ts';
import type { ParsedArgs } from '../parse.ts';
import { runTaskClaim } from './agent-task-actions.ts';

test('a claim matches Raft follow-up guidance without rerouting replies', async () => {
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

    expect(outputs.join('')).toBe(
        'Claim results (1 claimed):\n' +
            '#7 (msg:1a2b3c4d): claimed\n' +
            "Follow up in each task's thread:\n" +
            '#7 → grotto message send --target "#general:1a2b3c4d"\n'
    );
    expect(outputs.join('')).not.toContain('Work it in thread target');
});
