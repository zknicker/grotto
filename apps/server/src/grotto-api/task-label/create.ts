import { taskLabelCreateInputSchema, taskLabelMutationSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { createTaskLabel } from '../../tasks/task-labels.ts';
import { taskProcedure } from '../task/procedure.ts';

export const createTaskLabelProcedure = taskProcedure
    .input(taskLabelCreateInputSchema)
    .output(taskLabelMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await createTaskLabel(ctx.grottoDb, ctx.member, input);
        emitDurableChatEvent({ audienceUserId: null, event: result.event });
        return { eventCursor: result.event.cursor, label: result.label };
    });
