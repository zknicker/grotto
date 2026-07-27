import { z } from 'zod';
import { serverIdSchema } from '../../servers/contracts.ts';
import {
    markServerDeleting,
    purgeDeletedServer,
    readServerDeletion,
    ServerDeleteDeniedError,
} from '../../servers/delete-server.ts';
import { emitServerUpdated } from '../server-events.ts';
import { memberProcedure } from './procedure.ts';

/**
 * Deletes a Server. The Owner's confirmation disables it immediately; the
 * PostgreSQL and local-attachment purge is kicked off but never awaited, so the
 * response returns at once and offline machines can never block it. A crash
 * before the purge finishes is recovered on the next boot.
 */
export const deleteServerProcedure = memberProcedure
    .input(z.object({ confirmation: z.string(), serverId: serverIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
        const result = await markServerDeleting(ctx.grottoDb, ctx.member, input);
        ctx.computerConnections.cleanupServer(result.serverId);
        emitServerUpdated({ serverId: result.serverId });
        queueMicrotask(() => {
            void purgeDeletedServer(ctx.grottoDb, ctx.attachmentRoot, result);
        });
        return result;
    });

export const serverDeletionStatusProcedure = memberProcedure
    .input(z.object({ deletionId: z.string().regex(/^sdl_[A-Za-z0-9_-]{16}$/u) }).strict())
    .query(async ({ ctx, input }) => {
        if (!ctx.member) {
            throw new ServerDeleteDeniedError('Sign in to read this Server deletion.');
        }
        return await readServerDeletion(ctx.grottoDb, ctx.member.id, input.deletionId);
    });
