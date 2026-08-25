import { chatMarkReadInputSchema, chatReadReceiptSchema } from '@grotto/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { markChatRead } from '../../chats/mark-read.ts';
import { chatProcedure } from './procedure.ts';

export const markChatReadProcedure = chatProcedure
    .input(chatMarkReadInputSchema)
    .output(chatReadReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await markChatRead(ctx.grottoDb, ctx.member, input);

        if (result.event && ctx.member) {
            emitDurableChatEvent({ audienceUserId: ctx.member.id, event: result.event });
        }

        return result.receipt;
    });
