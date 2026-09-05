import { askListOpenInputSchema, openAskListSchema } from '@grotto/api';
import { listOpenAsks } from '../../asks/list-open-asks.ts';
import { chatProcedure } from '../chat/procedure.ts';

export const listOpenAsksProcedure = chatProcedure
    .input(askListOpenInputSchema)
    .output(openAskListSchema)
    .query(async ({ ctx, input }) => await listOpenAsks(ctx.grottoDb, ctx.member, input));
