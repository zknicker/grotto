import { hostedTaskLabelCreateInputSchema, hostedTaskLabelMutationSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { createHostedTaskLabel } from '../../tasks/task-labels.ts';
import { taskProcedure } from '../task/procedure.ts';

export const createTaskLabelProcedure = taskProcedure
    .input(hostedTaskLabelCreateInputSchema)
    .output(hostedTaskLabelMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await createHostedTaskLabel(ctx.grottoDb, ctx.member, input);
        emitDurableChatEvent({ audienceUserId: null, event: result.event });
        return { eventCursor: result.event.cursor, label: result.label };
    });
