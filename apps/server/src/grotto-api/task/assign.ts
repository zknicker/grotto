import { hostedTaskAssignInputSchema, hostedTaskMutationSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { assignHostedTask } from '../../tasks/assign-task.ts';
import { taskProcedure } from './procedure.ts';

export const assignTaskProcedure = taskProcedure
    .input(hostedTaskAssignInputSchema)
    .output(hostedTaskMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await assignHostedTask(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return { eventCursor: result.event?.cursor ?? null, task: result.task };
    });
