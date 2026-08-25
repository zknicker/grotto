import { threadFollowInputSchema, threadFollowReceiptSchema } from '@grotto/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { setThreadFollow } from '../../threads/set-thread-follow.ts';
import { chatProcedure } from '../chat/procedure.ts';

export const setThreadFollowProcedure = chatProcedure
    .input(threadFollowInputSchema)
    .output(threadFollowReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await setThreadFollow(ctx.grottoDb, ctx.member, input);
        emitDurableChatEvent({ audienceUserId: ctx.member?.id ?? null, event: result.event });
        return result.receipt;
    });
