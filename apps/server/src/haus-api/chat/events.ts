import { chatEventsInputSchema, chatEventsSchema } from '@haus/api';
import { listChatEvents } from '../../chats/list-events.ts';
import { chatProcedure } from './procedure.ts';

export const listChatEventsProcedure = chatProcedure
    .input(chatEventsInputSchema)
    .output(chatEventsSchema)
    .query(async ({ ctx, input }) => await listChatEvents(ctx.hausDb, ctx.member, input));
