import { hostedMentionOptionsInputSchema, hostedMentionOptionsSchema } from '@tavern/api';
import { listHostedMentionOptions } from '../../chats/list-mention-options.ts';
import { chatProcedure } from './procedure.ts';

export const listMentionOptionsProcedure = chatProcedure
    .input(hostedMentionOptionsInputSchema)
    .output(hostedMentionOptionsSchema)
    .query(
        async ({ ctx, input }) => await listHostedMentionOptions(ctx.grottoDb, ctx.member, input)
    );
