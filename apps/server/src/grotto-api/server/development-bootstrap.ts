import { TRPCError } from '@trpc/server';
import { seedDevelopmentServer } from '../../development/seed-server.ts';
import { serverProcedure } from './procedure.ts';

export const developmentBootstrapProcedure = serverProcedure.mutation(async ({ ctx }) => {
    if (process.env.TAVERN_DEV_STACK !== '1') {
        throw new TRPCError({ code: 'NOT_FOUND' });
    }
    return await seedDevelopmentServer(ctx.grottoDb, ctx.clerkUserId);
});
