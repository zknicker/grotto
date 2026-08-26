import { expect, test } from 'bun:test';
import type { AgentApiRequest, AgentApiRequester } from '../agent-api-client.ts';
import type { ParsedArgs } from '../parse.ts';
import { runActionPrepare } from './agent-action.ts';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('prepares one typed action with exact local avatar bytes', async () => {
    const requests: AgentApiRequest[] = [];
    const output: string[] = [];
    const client: AgentApiRequester = {
        async request<T>(_route: string, _schema: unknown, input?: AgentApiRequest) {
            requests.push(input ?? {});
            return {
                action: {
                    chatId: 'cht_product',
                    createdAt: '2026-08-25T12:00:00.000Z',
                    executedAt: null,
                    executedByUserId: null,
                    id: 'act_1234567890abcdef',
                    kind: 'agent:create',
                    messageId: 'msg_1234567890abcdef',
                    proposerAgentId: 'agt_orbit',
                    proposal: {
                        computer: null,
                        description: null,
                        draftHint: null,
                        kind: 'agent:create',
                        name: 'Orbit',
                        avatar: {
                            byteSize: png.byteLength,
                            id: 'pam_1234567890abcdef',
                            mediaType: 'image/png',
                            sha256: 'a'.repeat(64),
                            url: '/api/prepared-action-media/pam_1234567890abcdef',
                        },
                    },
                    status: 'pending',
                    supersededAt: null,
                    supersededByActionId: null,
                },
                chatId: 'cht_product',
                idempotent: false,
                messageId: 'msg_1234567890abcdef',
                sequence: 4,
                target: '#product',
            } as T;
        },
    };

    const exitCode = await runActionPrepare(args(), {
        client,
        mintNonce: () => 'action-test',
        readFile: async () => png,
        readStdin: async () => '{"kind":"agent:create","name":"Orbit"}',
        stat: async () => ({ isFile: () => true, size: png.byteLength }),
        stdinIsTty: () => false,
        write: (text) => output.push(text),
    });

    expect(exitCode).toBe(0);
    expect(requests).toEqual([
        {
            body: {
                action: {
                    computer: null,
                    description: null,
                    draftHint: null,
                    kind: 'agent:create',
                    name: 'Orbit',
                },
                avatar: { bytesBase64: png.toString('base64'), mediaType: 'image/png' },
                nonce: 'action-test',
                target: '#product',
            },
            method: 'POST',
        },
    ]);
    expect(output[0]).toContain('Prepared agent:create action act_1234567890abcdef');
});

test('rejects invalid action JSON before calling the Server', async () => {
    let calls = 0;
    await expect(
        runActionPrepare(args(), {
            client: {
                async request<T>() {
                    calls++;
                    return {} as T;
                },
            },
            mintNonce: () => 'action-test',
            readFile: async () => png,
            readStdin: async () => '{"kind":"agent:create","role":"admin"}',
            stat: async () => ({ isFile: () => true, size: png.byteLength }),
            stdinIsTty: () => false,
            write: () => {},
        })
    ).rejects.toMatchObject({ code: 'INVALID_ARG' });
    expect(calls).toBe(0);
});

test('rejects a missing avatar file before reading stdin or calling the Server', async () => {
    let calls = 0;
    await expect(
        runActionPrepare(args(), {
            client: {
                async request<T>() {
                    calls++;
                    return {} as T;
                },
            },
            mintNonce: () => 'action-test',
            readFile: async () => png,
            readStdin: async () => '{"kind":"agent:create","name":"Orbit"}',
            stat: async () => {
                throw new Error('not found');
            },
            stdinIsTty: () => false,
            write: () => {},
        })
    ).rejects.toMatchObject({ code: 'INVALID_ARG' });
    expect(calls).toBe(0);
});

function args(
    values: Record<string, string> = { '--avatar-file': './orbit.png', '--target': '#product' }
): ParsedArgs {
    return { flags: {}, help: false, positionals: [], valueLists: {}, values };
}
