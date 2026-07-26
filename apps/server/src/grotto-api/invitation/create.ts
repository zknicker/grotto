import { createdServerInvitationSchema, createServerInvitationInputSchema } from '@tavern/api';
import { createServerInvitation } from '../../servers/create-invitation.ts';
import { emitServerUpdated } from '../server-events.ts';
import { invitationProcedure } from './procedure.ts';

export const createInvitationProcedure = invitationProcedure
    .input(createServerInvitationInputSchema)
    .output(createdServerInvitationSchema)
    .mutation(async ({ ctx, input }) => {
        const created = await createServerInvitation(ctx.grottoDb, ctx.member, input);

        emitServerUpdated({ serverId: input.serverId });
        return created;
    });
