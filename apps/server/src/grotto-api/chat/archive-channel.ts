import { channelLifecycleInputSchema, channelLifecycleReceiptSchema } from '@tavern/api';
import { archiveChannel } from '../../chats/channel-lifecycle.ts';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { chatProcedure } from './procedure.ts';

export const archiveChannelProcedure = chatProcedure
    .input(channelLifecycleInputSchema)
    .output(channelLifecycleReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await archiveChannel(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return result.receipt;
    });
