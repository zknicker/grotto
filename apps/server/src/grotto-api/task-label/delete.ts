import { hostedTaskLabelDeleteInputSchema, hostedTaskLabelMutationSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { deleteHostedTaskLabel } from '../../tasks/task-labels.ts';
import { taskProcedure } from '../task/procedure.ts';

export const deleteTaskLabelProcedure = taskProcedure
    .input(hostedTaskLabelDeleteInputSchema)
    .output(hostedTaskLabelMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await deleteHostedTaskLabel(ctx.grottoDb, ctx.member, input);
        emitDurableChatEvent({ audienceUserId: null, event: result.event });
        return { eventCursor: result.event.cursor, label: null };
    });
