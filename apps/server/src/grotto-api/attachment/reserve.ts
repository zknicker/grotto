import { hostedAttachmentReservationSchema, hostedAttachmentReserveInputSchema } from '@tavern/api';
import { reserveHostedAttachment } from '../../attachments/reserve-attachment.ts';
import { attachmentProcedure } from './procedure.ts';

export const reserveAttachmentProcedure = attachmentProcedure
    .input(hostedAttachmentReserveInputSchema)
    .output(hostedAttachmentReservationSchema)
    .mutation(
        async ({ ctx, input }) => await reserveHostedAttachment(ctx.grottoDb, ctx.member, input)
    );
