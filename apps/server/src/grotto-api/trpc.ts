import { appProtocolVersion } from '@grotto/api';
import { initTRPC, TRPCError } from '@trpc/server';
import type { GrottoContext } from './context.ts';

const t = initTRPC.context<GrottoContext>().create();

export const createRouter = t.router;
const appProcedure = t.procedure.use(({ ctx, next }) => {
    if (ctx.appProtocol.productVersion && ctx.appProtocol.protocolVersion === appProtocolVersion) {
        return next();
    }

    throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Update required: this Grotto App no longer matches the Server protocol.',
    });
});

export const computerProcedure = appProcedure;
export const publicProcedure = appProcedure;

/**
 * Verifies the Clerk session and carries its external subject for this request
 * only. Every Server operation — queries, mutations, and each subscription
 * start — is judged against a current token, so an expired session cannot ride
 * an already-open WebSocket. It deliberately touches no database: minting a
 * User is part of Server creation's transaction, never a side effect of
 * reading.
 */
export const humanProcedure = appProcedure.use(async ({ ctx, next }) => {
    if (!ctx.clerkSessionToken) {
        throw unauthorized();
    }

    let clerkUserId: string;

    try {
        ({ clerkUserId } = await ctx.clerkSessions.verify(ctx.clerkSessionToken));
    } catch (cause) {
        throw unauthorized(cause);
    }

    return await next({ ctx: { ...ctx, clerkUserId } });
});

function unauthorized(cause?: unknown) {
    return new TRPCError({
        cause,
        code: 'UNAUTHORIZED',
        message: 'Sign in to use this Grotto server.',
    });
}
