import { TRPCError } from '@trpc/server';
import { sendPendingDevelopmentCoveApplication } from '../../development/seed-cove.ts';
import { seedDevelopmentServer } from '../../development/seed-server.ts';
import { serverProcedure } from './procedure.ts';

export const developmentBootstrapProcedure = serverProcedure.mutation(async ({ ctx }) => {
    if (process.env.HAUS_DEV_STACK !== '1') {
        throw new TRPCError({ code: 'NOT_FOUND' });
    }
    const server = await seedDevelopmentServer(ctx.hausDb, ctx.clerkUserId, {
        attachmentRoot: ctx.attachmentRoot,
    });
    await sendPendingDevelopmentCoveApplication(ctx.hausDb, ctx.computerConnections, server.id);
    return server;
});
