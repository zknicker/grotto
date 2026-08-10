import {
    hostedChannelLifecycleInputSchema,
    hostedChannelLifecycleReceiptSchema,
} from '@tavern/api';
import { archiveHostedChannel } from '../../chats/channel-lifecycle.ts';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { chatProcedure } from './procedure.ts';

export const archiveChannelProcedure = chatProcedure
    .input(hostedChannelLifecycleInputSchema)
    .output(hostedChannelLifecycleReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await archiveHostedChannel(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return result.receipt;
    });
