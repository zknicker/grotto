import { hostedThreadFollowInputSchema, hostedThreadFollowReceiptSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { setHostedThreadFollow } from '../../threads/set-thread-follow.ts';
import { chatProcedure } from '../chat/procedure.ts';

export const setThreadFollowProcedure = chatProcedure
    .input(hostedThreadFollowInputSchema)
    .output(hostedThreadFollowReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await setHostedThreadFollow(ctx.grottoDb, ctx.member, input);
        emitDurableChatEvent({ audienceUserId: ctx.member?.id ?? null, event: result.event });
        return result.receipt;
    });
