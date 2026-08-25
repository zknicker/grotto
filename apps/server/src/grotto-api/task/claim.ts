import { taskMutationInputSchema, taskMutationSchema } from '@grotto/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { claimTask } from '../../tasks/claim-task.ts';
import { taskProcedure } from './procedure.ts';

export const claimTaskProcedure = taskProcedure
    .input(taskMutationInputSchema)
    .output(taskMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await claimTask(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return { eventCursor: result.event?.cursor ?? null, task: result.task };
    });
