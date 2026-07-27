import { createRouter } from '../trpc.ts';
import { inventoryAttachmentsProcedure } from './inventory.ts';
import { reserveAttachmentProcedure } from './reserve.ts';

export const attachmentRouter = createRouter({
    inventory: inventoryAttachmentsProcedure,
    reserve: reserveAttachmentProcedure,
});
