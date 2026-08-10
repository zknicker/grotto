import {
    hostedChannelLifecycleInputSchema,
    hostedChannelLifecycleReceiptSchema,
} from '@tavern/api';
import { unarchiveHostedChannel } from '../../chats/channel-lifecycle.ts';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { chatProcedure } from './procedure.ts';

export const unarchiveChannelProcedure = chatProcedure
    .input(hostedChannelLifecycleInputSchema)
    .output(hostedChannelLifecycleReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await unarchiveHostedChannel(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return result.receipt;
    });
