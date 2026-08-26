import { expect, test } from 'bun:test';
import type { ZodType } from 'zod';
import type { AgentApiRequest, AgentApiRequester } from '../agent-api-client.ts';
import type { ParsedArgs } from '../parse.ts';
import { runAvatarGenerate } from './agent-avatar.ts';

const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
const response = {
    avatar: {
        bytesBase64: Buffer.from(bytes).toString('base64'),
        byteSize: bytes.byteLength,
        height: 256 as const,
        mediaType: 'image/png' as const,
        width: 256 as const,
    },
};

test('writes exactly one generated avatar to the caller-selected path', async () => {
    const requests: unknown[] = [];
    const writes: { bytes: Uint8Array; path: string }[] = [];
    const output: string[] = [];
    const client: AgentApiRequester = {
        async request<T>(_route: string, _schema: ZodType<T>, input?: AgentApiRequest) {
            requests.push(input);
            return response as T;
        },
    };
    const exitCode = await runAvatarGenerate(
        args({ '--concept': '  cloud fox  ', '--output': './out/avatar.png' }),
        {
            client,
            write: (text) => {
                output.push(text);
            },
            writeFile: async (path, data) => {
                writes.push({ bytes: data, path });
            },
        }
    );

    expect(exitCode).toBe(0);
    expect(requests).toEqual([
        {
            body: { concept: 'cloud fox' },
            method: 'POST',
            timeoutMs: 75_000,
        },
    ]);
    expect(writes).toEqual([{ bytes, path: './out/avatar.png' }]);
    expect(output[0]).toContain('Generated avatar: ./out/avatar.png');
});

test('requires both the concept and output file without calling the Server', async () => {
    const client: AgentApiRequester = {
        async request<T>() {
            return response as T;
        },
    };
    await expect(
        runAvatarGenerate(args({ '--output': './avatar.png' }), {
            client,
            write: () => {},
            writeFile: async () => {},
        })
    ).rejects.toMatchObject({ code: 'INVALID_ARG' });
    await expect(
        runAvatarGenerate(args({ '--concept': 'fox' }), {
            client,
            write: () => {},
            writeFile: async () => {},
        })
    ).rejects.toMatchObject({ code: 'INVALID_ARG' });
});

test('maps a local output failure without pretending the file was written', async () => {
    await expect(
        runAvatarGenerate(args({ '--concept': 'fox', '--output': './avatar.png' }), {
            client: {
                async request<T>() {
                    return response as T;
                },
            },
            write: () => {},
            writeFile: async () => {
                throw new Error('permission denied');
            },
        })
    ).rejects.toMatchObject({ code: 'OUTPUT_WRITE_FAILED' });
});

function args(values: Record<string, string>): ParsedArgs {
    return { flags: {}, help: false, positionals: [], valueLists: {}, values };
}
