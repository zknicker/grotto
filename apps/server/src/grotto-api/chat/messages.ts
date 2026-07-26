import { hostedChatMessagePageSchema, hostedChatMessagesInputSchema } from '@tavern/api';
import { listHostedChatMessages } from '../../chats/list-messages.ts';
import { chatProcedure } from './procedure.ts';

export const listChatMessagesProcedure = chatProcedure
    .input(hostedChatMessagesInputSchema)
    .output(hostedChatMessagePageSchema)
    .query(async ({ ctx, input }) => await listHostedChatMessages(ctx.grottoDb, ctx.member, input));
