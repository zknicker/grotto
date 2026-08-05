import { getServerMemberInputSchema, serverMemberSchema } from '@tavern/api';
import { getServerMember } from '../../servers/get-member.ts';
import { serverMemberProcedure } from './procedure.ts';

export const getMemberProcedure = serverMemberProcedure
    .input(getServerMemberInputSchema)
    .output(serverMemberSchema)
    .query(
        async ({ ctx, input }) =>
            await getServerMember(ctx.grottoDb, ctx.member, input.serverId, input.userId)
    );
