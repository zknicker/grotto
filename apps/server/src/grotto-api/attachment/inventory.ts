import { hostedAttachmentInventoryInputSchema, hostedAttachmentInventorySchema } from '@tavern/api';
import { inventoryHostedServerAttachments } from '../../attachments/inventory-attachments.ts';
import { attachmentProcedure } from './procedure.ts';

export const inventoryAttachmentsProcedure = attachmentProcedure
    .input(hostedAttachmentInventoryInputSchema)
    .output(hostedAttachmentInventorySchema)
    .query(
        async ({ ctx, input }) =>
            await inventoryHostedServerAttachments(
                ctx.grottoDb,
                ctx.attachmentRoot,
                ctx.member,
                input.serverId
            )
    );
