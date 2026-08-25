import { chatGetInputSchema, chatSchema } from '@grotto/api';
import { getChat } from '../../chats/get-chat.ts';
import { chatProcedure } from './procedure.ts';

export const getChatProcedure = chatProcedure
    .input(chatGetInputSchema)
    .output(chatSchema)
    .query(async ({ ctx, input }) => await getChat(ctx.grottoDb, ctx.member, input));
