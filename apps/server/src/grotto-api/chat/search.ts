import { hostedChatSearchInputSchema, hostedChatSearchResultsSchema } from '@tavern/api';
import { searchHostedChatMessages } from '../../chats/search-messages.ts';
import { chatProcedure } from './procedure.ts';

export const searchChatMessagesProcedure = chatProcedure
    .input(hostedChatSearchInputSchema)
    .output(hostedChatSearchResultsSchema)
    .query(
        async ({ ctx, input }) => await searchHostedChatMessages(ctx.grottoDb, ctx.member, input)
    );
