import type { CloudAgentCapabilityRequest } from '@grotto/api';
import { TRPCError } from '@trpc/server';
import {
    CloudAgentCapabilityDeniedError,
    requestCloudAgentCapability,
} from '../../cloud-agents/request-cloud-agent-capability.ts';
import type { GrottoUser } from '../../users/grotto-user.ts';
import type { GrottoContext } from '../context.ts';
import { memberProcedure } from '../server/procedure.ts';
import { createRouter } from '../trpc.ts';
import {
    cloudAgentProviderActionInputSchema,
    cloudAgentProviderGetInputSchema,
    cloudAgentProviderOutputSchema,
} from './contracts.ts';

/**
 * Cloud Agent provider access on one Computer. `connect` runs the provider's
 * own browser sign-in on that Computer; Server relays the request and never
 * sees, stores, or forwards the credential it mints.
 */
export const cloudAgentProviderRouter = createRouter({
    connect: actionProcedure('connect'),
    disconnect: actionProcedure('disconnect'),
    get: memberProcedure
        .input(cloudAgentProviderGetInputSchema)
        .output(cloudAgentProviderOutputSchema)
        .query(({ ctx, input }) => relay(ctx, input, { kind: 'get' })),
});

function actionProcedure(kind: 'connect' | 'disconnect') {
    return memberProcedure
        .input(cloudAgentProviderActionInputSchema)
        .output(cloudAgentProviderOutputSchema)
        .mutation(({ ctx, input }) => relay(ctx, input, { kind }));
}

async function relay(
    ctx: GrottoContext & { member: GrottoUser | null },
    input: { computerId: string; provider: 'cursor'; serverId: string },
    operation: CloudAgentCapabilityRequest['operation']
) {
    try {
        return await requestCloudAgentCapability(ctx.grottoDb, ctx.computerConnections, ctx.member, {
            ...input,
            operation,
        });
    } catch (cause) {
        if (cause instanceof CloudAgentCapabilityDeniedError) {
            throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
        }
        throw cause;
    }
}
