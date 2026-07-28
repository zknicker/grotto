import { TRPCError } from '@trpc/server';
import { seedHostedDevelopmentServer } from '../../development/seed-hosted-server.ts';
import { serverProcedure } from './procedure.ts';

export const developmentBootstrapProcedure = serverProcedure.mutation(async ({ ctx }) => {
    if (process.env.TAVERN_DEV_STACK !== '1') {
        throw new TRPCError({ code: 'NOT_FOUND' });
    }
    return await seedHostedDevelopmentServer(ctx.grottoDb, ctx.clerkUserId);
});
