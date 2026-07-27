import { acceptedServerInvitationSchema, serverInvitationTokenInputSchema } from '@tavern/api';
import { acceptServerInvitation } from '../../servers/accept-invitation.ts';
import { emitServerUpdated } from '../server-events.ts';
import { invitationProcedure } from './procedure.ts';

export const acceptInvitationProcedure = invitationProcedure
    .input(serverInvitationTokenInputSchema)
    .output(acceptedServerInvitationSchema)
    .mutation(async ({ ctx, input }) => {
        const accepted = await acceptServerInvitation(
            ctx.grottoDb,
            ctx.clerkUsers,
            ctx.clerkUserId,
            input.token
        );

        // A new member changes the directory and retires an invitation, so any
        // members page already open elsewhere refreshes instead of going stale.
        emitServerUpdated({ serverId: accepted.serverId });
        return accepted;
    });
