import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assertEvalCleanupAllowed } from '../src/grotto-api/dev/cleanup-eval-chats.ts';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness | undefined;
let owner: GrottoClient | undefined;
let outsider: GrottoClient | undefined;
let signedOut: GrottoClient | undefined;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = createGrottoClient(
        harness,
        await harness.clerk.mintSessionToken('user_eval_cleanup_owner')
    );
    outsider = createGrottoClient(
        harness,
        await harness.clerk.mintSessionToken('user_eval_cleanup_outsider')
    );
    signedOut = createGrottoClient(harness);
});

afterAll(async () => {
    owner?.close();
    outsider?.close();
    signedOut?.close();
    await harness?.close();
});

describe('dev.cleanupEvalChats', () => {
    test('is unavailable in production and away from localhost', () => {
        expect(() =>
            assertEvalCleanupAllowed('localhost:8080', { nodeEnvironment: 'production' })
        ).toThrow('unavailable in production');
        expect(() =>
            assertEvalCleanupAllowed('grotto.example.com', { nodeEnvironment: 'test' })
        ).toThrow('available only from localhost');
    });

    test('requires authentication and membership in the requested Server', async () => {
        if (!(owner && outsider && signedOut)) {
            throw new Error('Expected Server test clients.');
        }
        const server = await owner.trpc.server.create.mutate({
            displayName: 'Eval Cleanup Access',
            slug: 'eval-cleanup-access',
        });
        await outsider.trpc.server.create.mutate({
            displayName: 'Outsider Root',
            slug: 'eval-cleanup-outsider',
        });

        await expect(
            signedOut.trpc.dev.cleanupEvalChats.mutate({
                chatIds: [server.channels[0].id],
                serverId: server.id,
            })
        ).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });
        await expect(
            outsider.trpc.dev.cleanupEvalChats.mutate({
                chatIds: [server.channels[0].id],
                serverId: server.id,
            })
        ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    });

    test('deletes only explicit chats from the requested Server and cascades their rows', async () => {
        if (!(harness && owner)) {
            throw new Error('Expected Server test harness and owner client.');
        }
        const server = await owner.trpc.server.create.mutate({
            displayName: 'Eval Cleanup Target',
            slug: 'eval-cleanup-target',
        });
        const otherServer = await owner.trpc.server.create.mutate({
            displayName: 'Eval Cleanup Other',
            slug: 'eval-cleanup-other',
        });
        const parentChatId = server.channels[0].id;
        const otherChatId = otherServer.channels[0].id;
        const anchor = await owner.trpc.chat.send.mutate({
            chatId: parentChatId,
            content: 'Temporary eval anchor',
            nonce: 'eval-cleanup-anchor',
            serverId: server.id,
        });
        const reply = await owner.trpc.chat.send.mutate({
            chatId: parentChatId,
            content: 'Temporary eval reply',
            nonce: 'eval-cleanup-reply',
            serverId: server.id,
            thread: { anchorMessageId: anchor.message.id },
        });
        const threadChatId = reply.threadChatId;
        if (!threadChatId) {
            throw new Error('Expected eval cleanup fixture to create a Thread.');
        }
        const agentId = 'agt_eval_cleanup';
        const reminderId = 'rem_eval_cleanup';
        await harness.sql`
            insert into agents (id, server_id, handle, display_name, home_timezone, role)
            values (${agentId}, ${server.id}, 'eval-cleanup', 'Eval Cleanup', 'UTC', 'member')
        `;
        await harness.sql`
            insert into reminders (
                id, server_id, owner_agent_id, anchor_chat_id, anchor_message_id,
                title, fire_at, timezone, status, created_at, updated_at
            )
            values (
                ${reminderId}, ${server.id}, ${agentId}, ${parentChatId}, ${anchor.message.id},
                'Temporary eval reminder', now() + interval '1 hour', 'UTC', 'scheduled', now(), now()
            )
        `;

        await expect(
            owner.trpc.dev.cleanupEvalChats.mutate({
                chatIds: [parentChatId, threadChatId, otherChatId],
                serverId: server.id,
            })
        ).resolves.toEqual({
            count: 2,
            deletedChatIds: [parentChatId, threadChatId].sort(),
        });

        const deletedChats = await harness.sql`
            select id from chats
            where server_id = ${server.id}
              and id in (${parentChatId}, ${threadChatId})
        `;
        const deletedMessages = await harness.sql`
            select id from chat_messages
            where server_id = ${server.id}
              and chat_id in (${parentChatId}, ${threadChatId})
        `;
        const deletedReminders = await harness.sql`
            select id from reminders
            where server_id = ${server.id} and id = ${reminderId}
        `;
        const [preservedOtherChat] = await harness.sql`
            select id from chats
            where server_id = ${otherServer.id} and id = ${otherChatId}
        `;

        expect(deletedChats).toHaveLength(0);
        expect(deletedMessages).toHaveLength(0);
        expect(deletedReminders).toHaveLength(0);
        expect(preservedOtherChat?.id).toBe(otherChatId);
    });
});
