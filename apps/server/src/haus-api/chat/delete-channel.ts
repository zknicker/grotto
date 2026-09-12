import { channelDeleteInputSchema, channelDeleteReceiptSchema } from '@haus/api';
import { deleteChannel } from '../../chats/channel-lifecycle.ts';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { chatProcedure } from './procedure.ts';

export const deleteChannelProcedure = chatProcedure
    .input(channelDeleteInputSchema)
    .output(channelDeleteReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await deleteChannel(ctx.hausDb, ctx.attachmentRoot, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return result.receipt;
    });
