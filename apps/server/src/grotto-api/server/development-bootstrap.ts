import { TRPCError } from '@trpc/server';
import { sendPendingDevelopmentCoveApplication } from '../../development/seed-cove.ts';
import { seedDevelopmentServer } from '../../development/seed-server.ts';
import { serverProcedure } from './procedure.ts';

export const developmentBootstrapProcedure = serverProcedure.mutation(async ({ ctx }) => {
    if (process.env.GROTTO_DEV_STACK !== '1') {
        throw new TRPCError({ code: 'NOT_FOUND' });
    }
    const server = await seedDevelopmentServer(ctx.grottoDb, ctx.clerkUserId);
    await sendPendingDevelopmentCoveApplication(ctx.grottoDb, ctx.computerConnections, server.id);
    return server;
});
