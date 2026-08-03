import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { chatsTable, remindersTable } from '../../postgres/schema.ts';
import { requireServerMembership } from '../../servers/server-access.ts';
import { memberProcedure } from '../server/procedure.ts';

const localhostHostPattern = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/u;
const cleanupEvalChatsInputSchema = z.object({
    chatIds: z.array(z.string().min(1)).min(1).max(20),
    serverId: z.string().min(1),
});

interface CleanupEvalChatsDependencies {
    nodeEnvironment?: string;
}

function getDependencies(): CleanupEvalChatsDependencies {
    return { nodeEnvironment: process.env.NODE_ENV };
}

export function createCleanupEvalChatsProcedure(
    getProcedureDependencies: () => CleanupEvalChatsDependencies = getDependencies
) {
    return memberProcedure.input(cleanupEvalChatsInputSchema).mutation(async ({ ctx, input }) => {
        assertEvalCleanupAllowed(ctx.requestHost, getProcedureDependencies());
        await requireServerMembership(ctx.grottoDb, ctx.member, input.serverId);

        const chatIds = [...new Set(input.chatIds)];
        const deleted = await ctx.grottoDb.transaction(async (tx) => {
            await tx
                .delete(remindersTable)
                .where(
                    and(
                        eq(remindersTable.serverId, input.serverId),
                        inArray(remindersTable.anchorChatId, chatIds)
                    )
                );
            return await tx
                .delete(chatsTable)
                .where(
                    and(eq(chatsTable.serverId, input.serverId), inArray(chatsTable.id, chatIds))
                )
                .returning({ id: chatsTable.id });
        });
        const deletedChatIds = deleted.map((chat) => chat.id).sort();

        return { count: deletedChatIds.length, deletedChatIds };
    });
}

export const cleanupEvalChatsRoute = createCleanupEvalChatsProcedure();

export function assertEvalCleanupAllowed(
    requestHost: string | null,
    dependencies: CleanupEvalChatsDependencies
) {
    if (dependencies.nodeEnvironment === 'production') {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Agent eval cleanup is unavailable in production.',
        });
    }

    if (!(requestHost && localhostHostPattern.test(requestHost.toLowerCase()))) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Agent eval cleanup is available only from localhost.',
        });
    }
}
