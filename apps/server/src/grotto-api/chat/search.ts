import { chatSearchInputSchema, chatSearchResultsSchema } from '@grotto/api';
import { searchChatMessages } from '../../chats/search-messages.ts';
import { chatProcedure } from './procedure.ts';

export const searchChatMessagesProcedure = chatProcedure
    .input(chatSearchInputSchema)
    .output(chatSearchResultsSchema)
    .query(async ({ ctx, input }) => await searchChatMessages(ctx.grottoDb, ctx.member, input));
