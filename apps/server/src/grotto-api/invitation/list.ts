import { listServerInvitationsInputSchema, serverInvitationListSchema } from '@tavern/api';
import { listServerInvitations } from '../../servers/list-invitations.ts';
import { invitationProcedure } from './procedure.ts';

export const listInvitationsProcedure = invitationProcedure
    .input(listServerInvitationsInputSchema)
    .output(serverInvitationListSchema)
    .query(
        async ({ ctx, input }) =>
            await listServerInvitations(ctx.grottoDb, ctx.member, input.serverId)
    );
