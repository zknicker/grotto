import { expect, test } from 'bun:test';
import type * as z from 'zod';
import type { AgentApiRequester } from '../agent-api-client.ts';
import type { AgentCliMessage } from '../agent-api-schemas.ts';
import { renderHistory } from '../agent-render.ts';
import { runCheck } from './agent-message.ts';

function message(id: string, sequence: number): AgentCliMessage {
    return {
        attachments: [],
        author: { id: 'usr_operator', kind: 'user', label: 'Operator', metadata: {} },
        chat_id: 'chat_messages',
        content: `body-${id}`,
        created_at: `2026-08-17T12:00:${String(sequence).padStart(2, '0')}.000Z`,
        deleted_at: null,
        delivery_id: null,
        id,
        metadata: {},
        nonce: null,
        role: 'user',
        sender: { description: null, handle: 'operator', type: 'human' },
        sequence,
    };
}

function depsFor(client: AgentApiRequester, outputs: string[]) {
    return {
        client,
        mintNonce: () => 'nonce',
        readStdin: async () => '',
        stdinIsTty: false,
        write: (text: string) => outputs.push(text),
    };
}

test('message check uses Raft empty-inbox wording', async () => {
    const outputs: string[] = [];
    const client: AgentApiRequester = {
        request: async <T>(_route: string, schema: z.ZodType<T>) =>
            schema.parse({ messages: [], more: false }) as T,
    };
    await runCheck(depsFor(client, outputs));

    expect(outputs[0]).toBe('No new messages.\n');
});

test('message check drains and aggregates multiple pages in one invocation', async () => {
    const outputs: string[] = [];
    const pages = [
        {
            messages: [{ message: message('msg_first', 1), target: '#general' }],
            more: true,
        },
        {
            messages: [{ message: message('msg_second', 2), target: 'dm:@operator' }],
            more: false,
        },
    ];
    let calls = 0;
    const client: AgentApiRequester = {
        request: async <T>(_route: string, schema: z.ZodType<T>) =>
            schema.parse(pages[calls++]) as T,
    };

    await runCheck(depsFor(client, outputs));

    expect(calls).toBe(2);
    expect(outputs[0]).toContain('msg=first');
    expect(outputs[0]).toContain('msg=second');
    expect(outputs[0]).toEndWith('No more new messages.\n');
});

test('message check explains a restored Thread follow and its exact undo command', async () => {
    const outputs: string[] = [];
    const client: AgentApiRequester = {
        request: async <T>(_route: string, schema: z.ZodType<T>) =>
            schema.parse({
                messages: [
                    {
                        message: message('msg_restored', 1),
                        target: '#general:deadbeef',
                        threadFollowReactivated: true,
                    },
                ],
                more: false,
            }) as T,
    };

    await runCheck(depsFor(client, outputs));

    expect(outputs[0]).toContain(
        '[Grotto thread follow restored: this @mention re-subscribed you to ordinary replies in #general:deadbeef.]'
    );
    expect(outputs[0]).toContain(
        'To stop those replies again: grotto thread unfollow --target "#general:deadbeef"'
    );
});

test('message check stops after Raft’s 50-round drain cap', async () => {
    const outputs: string[] = [];
    let calls = 0;
    const client: AgentApiRequester = {
        request: async <T>(_route: string, schema: z.ZodType<T>) => {
            calls += 1;
            return schema.parse({
                messages: [{ message: message(`msg_${calls}`, calls), target: '#general' }],
                more: true,
            }) as T;
        },
    };

    await runCheck(depsFor(client, outputs));

    expect(calls).toBe(50);
    expect(outputs[0]).toContain('body-msg_50');
    expect(outputs[0]).toEndWith('More messages are pending — run grotto message check again.\n');
});

test('history preserves restoration guidance when it is the first visible path', () => {
    const output = renderHistory({
        has_more: false,
        has_newer: false,
        has_older: false,
        last_read: { after: 0, unread_after: -1 },
        messages: [message('msg_restored', 1)],
        target: '#general:deadbeef',
        thread_follow_reactivated_message_ids: ['msg_restored'],
    });

    expect(output).toContain(
        '[Grotto thread follow restored: this @mention re-subscribed you to ordinary replies in #general:deadbeef.]'
    );
    expect(output).toContain(
        'To stop those replies again: grotto thread unfollow --target "#general:deadbeef"'
    );
});
