import { attachmentInventoryInputSchema, attachmentInventorySchema } from '@tavern/api';
import { inventoryServerAttachments } from '../../attachments/inventory-attachments.ts';
import { attachmentProcedure } from './procedure.ts';

export const inventoryAttachmentsProcedure = attachmentProcedure
    .input(attachmentInventoryInputSchema)
    .output(attachmentInventorySchema)
    .query(
        async ({ ctx, input }) =>
            await inventoryServerAttachments(
                ctx.grottoDb,
                ctx.attachmentRoot,
                ctx.member,
                input.serverId
            )
    );
