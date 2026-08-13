import { attachmentReservationSchema, attachmentReserveInputSchema } from '@tavern/api';
import { reserveAttachment } from '../../attachments/reserve-attachment.ts';
import { attachmentProcedure } from './procedure.ts';

export const reserveAttachmentProcedure = attachmentProcedure
    .input(attachmentReserveInputSchema)
    .output(attachmentReservationSchema)
    .mutation(async ({ ctx, input }) => await reserveAttachment(ctx.grottoDb, ctx.member, input));
