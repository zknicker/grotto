import {
    hostedMcpConnectionCreateSchema,
    hostedMcpConnectionInputSchema,
    hostedMcpConnectionListInputSchema,
    hostedMcpConnectionListSchema,
    hostedMcpConnectionSchema,
    hostedMcpGrantInputSchema,
    hostedMcpGrantSchema,
    hostedMcpHeadersUpdateSchema,
    hostedMcpOAuthStartResultSchema,
    hostedMcpOAuthStartSchema,
    hostedMcpPresetAccountCreateSchema,
} from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { HostedMcpDeniedError } from '../../hosted-mcp/errors.ts';
import { createHostedMcpPresetAccount } from '../../hosted-mcp/presets.ts';
import {
    createHostedMcpConnection,
    deleteHostedMcpConnection,
    disconnectHostedMcpConnection,
    refreshHostedMcpConnection,
    replaceHostedMcpHeaders,
    startHostedMcpOAuth,
} from '../../hosted-mcp/service.ts';
import { listHostedMcpConnections, setHostedMcpGrant } from '../../hosted-mcp/state.ts';
import { memberProcedure } from '../server/procedure.ts';
import { emitServerUpdated } from '../server-events.ts';
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
            withMcpUpdate(input.serverId, () =>
                createHostedMcpConnection(ctx.grottoDb, ctx.mcpRuntime, ctx.member, input)
            )
        ),
    addPresetAccount: guarded
        .input(hostedMcpPresetAccountCreateSchema)
        .output(hostedMcpConnectionSchema)
        .mutation(({ ctx, input }) =>
            withMcpUpdate(input.serverId, () =>
                createHostedMcpPresetAccount(ctx.grottoDb, ctx.mcpRuntime, ctx.member, input)
            )
        ),
    delete: guarded
        .input(hostedMcpConnectionInputSchema)
        .output(hostedMcpConnectionSchema)
        .mutation(({ ctx, input }) =>
            withMcpUpdate(input.serverId, () =>
                deleteHostedMcpConnection(ctx.grottoDb, ctx.mcpRuntime, ctx.member, input)
            )
        ),
    disconnect: guarded
        .input(hostedMcpConnectionInputSchema)
        .output(hostedMcpConnectionSchema)
        .mutation(({ ctx, input }) =>
            withMcpUpdate(input.serverId, () =>
                disconnectHostedMcpConnection(ctx.grottoDb, ctx.mcpRuntime, ctx.member, input)
            )
        ),
    list: guarded
        .input(hostedMcpConnectionListInputSchema)
        .output(hostedMcpConnectionListSchema)
        .query(({ ctx, input }) =>
            listHostedMcpConnections(ctx.grottoDb, ctx.member, input.serverId)
        ),
    refresh: guarded
        .input(hostedMcpConnectionInputSchema)
        .output(hostedMcpConnectionSchema)
        .mutation(({ ctx, input }) =>
            withMcpUpdate(input.serverId, () =>
                refreshHostedMcpConnection(ctx.grottoDb, ctx.mcpRuntime, ctx.member, input)
            )
        ),
    replaceHeaders: guarded
        .input(hostedMcpHeadersUpdateSchema)
        .output(hostedMcpConnectionSchema)
        .mutation(({ ctx, input }) =>
            withMcpUpdate(input.serverId, () =>
                replaceHostedMcpHeaders(ctx.grottoDb, ctx.mcpRuntime, ctx.member, input)
            )
        ),
    setGrant: guarded
        .input(hostedMcpGrantInputSchema)
        .output(hostedMcpGrantSchema)
        .mutation(({ ctx, input }) =>
            withMcpUpdate(input.serverId, () => setHostedMcpGrant(ctx.grottoDb, ctx.member, input))
        ),
    startOAuth: guarded
        .input(hostedMcpOAuthStartSchema)
        .output(hostedMcpOAuthStartResultSchema)
        .mutation(({ ctx, input }) =>
            withMcpUpdate(input.serverId, () =>
                startHostedMcpOAuth(
                    ctx.grottoDb,
                    ctx.mcpRuntime,
                    ctx.mcpOAuthRelay,
                    ctx.member,
                    input
                )
            )
        ),
});

async function withMcpUpdate<Result>(serverId: string, operation: () => Promise<Result>) {
    const result = await operation();
    emitServerUpdated({ scope: 'mcp', serverId });
    return result;
}
