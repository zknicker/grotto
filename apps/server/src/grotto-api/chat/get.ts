import { hostedChatGetInputSchema, hostedChatSchema } from '@tavern/api';
import { getHostedChat } from '../../chats/get-chat.ts';
import { chatProcedure } from './procedure.ts';

export const getChatProcedure = chatProcedure
    .input(hostedChatGetInputSchema)
    .output(hostedChatSchema)
    .query(async ({ ctx, input }) => await getHostedChat(ctx.grottoDb, ctx.member, input));
