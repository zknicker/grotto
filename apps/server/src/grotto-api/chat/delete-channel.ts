import { hostedChannelDeleteInputSchema, hostedChannelDeleteReceiptSchema } from '@tavern/api';
import { deleteHostedChannel } from '../../chats/channel-lifecycle.ts';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { chatProcedure } from './procedure.ts';

export const deleteChannelProcedure = chatProcedure
    .input(hostedChannelDeleteInputSchema)
    .output(hostedChannelDeleteReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await deleteHostedChannel(
            ctx.grottoDb,
            ctx.attachmentRoot,
            ctx.member,
            input
        );
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return result.receipt;
    });
