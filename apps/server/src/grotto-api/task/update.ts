import { hostedTaskMutationSchema, hostedTaskUpdateInputSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { updateHostedTask } from '../../tasks/update-task.ts';
import { taskProcedure } from './procedure.ts';

export const updateTaskProcedure = taskProcedure
    .input(hostedTaskUpdateInputSchema)
    .output(hostedTaskMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await updateHostedTask(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return { eventCursor: result.event?.cursor ?? null, task: result.task };
    });
