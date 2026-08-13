import { taskAssignInputSchema, taskMutationSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { assignTask } from '../../tasks/assign-task.ts';
import { taskProcedure } from './procedure.ts';

export const assignTaskProcedure = taskProcedure
    .input(taskAssignInputSchema)
    .output(taskMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await assignTask(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return { eventCursor: result.event?.cursor ?? null, task: result.task };
    });
