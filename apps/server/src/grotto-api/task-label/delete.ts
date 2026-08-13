import { taskLabelDeleteInputSchema, taskLabelMutationSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { deleteTaskLabel } from '../../tasks/task-labels.ts';
import { taskProcedure } from '../task/procedure.ts';

export const deleteTaskLabelProcedure = taskProcedure
    .input(taskLabelDeleteInputSchema)
    .output(taskLabelMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await deleteTaskLabel(ctx.grottoDb, ctx.member, input);
        emitDurableChatEvent({ audienceUserId: null, event: result.event });
        return { eventCursor: result.event.cursor, label: null };
    });
