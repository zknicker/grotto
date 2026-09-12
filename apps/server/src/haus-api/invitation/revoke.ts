import { revokeServerInvitationInputSchema, serverInvitationSchema } from '@haus/api';
import { revokeServerInvitation } from '../../servers/revoke-invitation.ts';
import { emitServerUpdated } from '../server-events.ts';
import { invitationProcedure } from './procedure.ts';

export const revokeInvitationProcedure = invitationProcedure
    .input(revokeServerInvitationInputSchema)
    .output(serverInvitationSchema)
    .mutation(async ({ ctx, input }) => {
        const revoked = await revokeServerInvitation(ctx.hausDb, ctx.member, input);

        emitServerUpdated({ serverId: input.serverId });
        return revoked;
    });
