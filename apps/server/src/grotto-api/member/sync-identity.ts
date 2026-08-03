import { hostedSyncHumanIdentityInputSchema } from '@tavern/api';
import { syncHumanIdentity } from '../../servers/human-profile.ts';
import { serverMemberProcedure } from './procedure.ts';

/** The App reports its Clerk identity so a human has a name others can read. */
export const syncHumanIdentityProcedure = serverMemberProcedure
    .input(hostedSyncHumanIdentityInputSchema)
    .mutation(async ({ ctx, input }) => {
        await syncHumanIdentity(ctx.grottoDb, ctx.member, input);
    });
