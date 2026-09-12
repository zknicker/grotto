import { taskMutationSchema, taskUpdateInputSchema } from '@haus/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { updateTask } from '../../tasks/update-task.ts';
import { taskProcedure } from './procedure.ts';

export const updateTaskProcedure = taskProcedure
    .input(taskUpdateInputSchema)
    .output(taskMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await updateTask(ctx.hausDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return { eventCursor: result.event?.cursor ?? null, task: result.task };
    });
