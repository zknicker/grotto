import { TRPCError } from '@trpc/server';
import { ServerSlugTakenError } from '../../servers/create-server.ts';
import { ServerAccessDeniedError, ServerNotFoundError } from '../../servers/server-access.ts';
import { findUserByClerkId } from '../../users/grotto-user.ts';
import { humanProcedure } from '../trpc.ts';

/**
 * Server work for one Clerk-authenticated human, with Server domain refusals
 * reported as the tRPC codes the App reacts to.
 */
export const serverProcedure = humanProcedure.use(async ({ next }) => {
    const result = await next();

    if (result.ok) {
        return result;
    }

    const { cause } = result.error;

    if (cause instanceof ServerAccessDeniedError) {
        throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
    }

    if (cause instanceof ServerNotFoundError) {
        throw new TRPCError({ cause, code: 'NOT_FOUND', message: cause.message });
    }

    if (cause instanceof ServerSlugTakenError) {
        throw new TRPCError({ cause, code: 'CONFLICT', message: cause.message });
    }

    throw result.error;
});

/**
 * Reads and Server-scoped mutations resolve the existing Grotto User. A human
 * who has never created or joined a Server has none yet, and asking never
 * mints one.
 */
export const memberProcedure = serverProcedure.use(async ({ ctx, next }) => {
    const member = await findUserByClerkId(ctx.grottoDb, ctx.clerkUserId);

    return await next({ ctx: { ...ctx, member } });
});
