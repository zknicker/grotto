import {
    hostedMcpConnectionCreateSchema,
    hostedMcpConnectionListInputSchema,
    hostedMcpConnectionListSchema,
    hostedMcpConnectionSchema,
    hostedMcpGrantInputSchema,
    hostedMcpGrantSchema,
} from '@tavern/api';
import { TRPCError } from '@trpc/server';
import {
    createHostedMcpConnection,
    HostedMcpDeniedError,
    listHostedMcpConnections,
    setHostedMcpGrant,
} from '../../hosted-mcp/service.ts';
import { memberProcedure } from '../server/procedure.ts';
import { createRouter } from '../trpc.ts';

const guarded = memberProcedure.use(async ({ next }) => {
    const result = await next();
    if (!result.ok && result.error.cause instanceof HostedMcpDeniedError) {
        throw new TRPCError({
            cause: result.error.cause,
            code: 'FORBIDDEN',
            message: result.error.cause.message,
        });
    }
    return result;
});

export const mcpRouter = createRouter({
    add: guarded
        .input(hostedMcpConnectionCreateSchema)
        .output(hostedMcpConnectionSchema)
        .mutation(({ ctx, input }) =>
            createHostedMcpConnection(ctx.grottoDb, ctx.computerConnections, ctx.member, input)
        ),
    list: guarded
        .input(hostedMcpConnectionListInputSchema)
        .output(hostedMcpConnectionListSchema)
        .query(({ ctx, input }) =>
            listHostedMcpConnections(
                ctx.grottoDb,
                ctx.computerConnections,
                ctx.member,
                input.serverId
            )
        ),
    setGrant: guarded
        .input(hostedMcpGrantInputSchema)
        .output(hostedMcpGrantSchema)
        .mutation(({ ctx, input }) =>
            setHostedMcpGrant(ctx.grottoDb, ctx.computerConnections, ctx.member, input)
        ),
});
