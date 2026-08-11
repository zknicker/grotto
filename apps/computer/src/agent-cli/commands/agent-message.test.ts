import { expect, test } from 'bun:test';
import type * as z from 'zod';
import type { AgentApiRequester } from '../agent-api-client.ts';
import { runCheck } from './agent-message.ts';

test('message check uses Raft empty-inbox wording', async () => {
    const outputs: string[] = [];
    const client: AgentApiRequester = {
        request: async <T>(_route: string, schema: z.ZodType<T>) =>
            schema.parse({ messages: [], more: false }) as T,
    };
    const deps = {
        client,
        mintNonce: () => 'nonce',
        readStdin: async () => '',
        stdinIsTty: false,
        write: (text: string) => outputs.push(text),
    };

    await runCheck(deps);

    expect(outputs[0]).toBe('No new messages.\n');
});
