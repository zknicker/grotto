import { taskLabelMutationSchema, taskLabelUpdateInputSchema } from '@grotto/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { updateTaskLabel } from '../../tasks/task-labels.ts';
import { taskProcedure } from '../task/procedure.ts';

export const updateTaskLabelProcedure = taskProcedure
    .input(taskLabelUpdateInputSchema)
    .output(taskLabelMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await updateTaskLabel(ctx.grottoDb, ctx.member, input);
        emitDurableChatEvent({ audienceUserId: null, event: result.event });
        return { eventCursor: result.event.cursor, label: result.label };
    });
