import { createRouter } from '../trpc.ts';
import { acceptInvitationProcedure } from './accept.ts';
import { createInvitationProcedure } from './create.ts';
import { listInvitationsProcedure } from './list.ts';
import { previewInvitationProcedure } from './preview.ts';
import { revokeInvitationProcedure } from './revoke.ts';

export const invitationRouter = createRouter({
    accept: acceptInvitationProcedure,
    create: createInvitationProcedure,
    list: listInvitationsProcedure,
    preview: previewInvitationProcedure,
    revoke: revokeInvitationProcedure,
});
