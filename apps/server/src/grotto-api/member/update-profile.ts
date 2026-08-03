import { hostedUpdateHumanProfileInputSchema } from '@tavern/api';
import { updateHumanProfile } from '../../servers/human-profile.ts';
import { serverMemberProcedure } from './procedure.ts';

/** A human edits only their own profile; the caller identifies the target. */
export const updateHumanProfileProcedure = serverMemberProcedure
    .input(hostedUpdateHumanProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
        await updateHumanProfile(ctx.grottoDb, ctx.member, input);
    });
