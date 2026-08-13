import { mentionOptionsInputSchema, mentionOptionsSchema } from '@tavern/api';
import { listMentionOptions } from '../../chats/list-mention-options.ts';
import { chatProcedure } from './procedure.ts';

export const listMentionOptionsProcedure = chatProcedure
    .input(mentionOptionsInputSchema)
    .output(mentionOptionsSchema)
    .query(async ({ ctx, input }) => await listMentionOptions(ctx.grottoDb, ctx.member, input));
