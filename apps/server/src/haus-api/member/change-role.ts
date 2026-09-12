import { changeServerMemberRoleInputSchema, serverMemberSchema } from '@haus/api';
import { changeServerMemberRole } from '../../servers/change-member-role.ts';
import { emitServerUpdated } from '../server-events.ts';
import { serverMemberProcedure } from './procedure.ts';

export const changeMemberRoleProcedure = serverMemberProcedure
    .input(changeServerMemberRoleInputSchema)
    .output(serverMemberSchema)
    .mutation(async ({ ctx, input }) => {
        const member = await changeServerMemberRole(ctx.hausDb, ctx.member, input);

        emitServerUpdated({ serverId: input.serverId });
        return member;
    });
