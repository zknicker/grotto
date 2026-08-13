import { taskMutationInputSchema, taskMutationSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { unclaimTask } from '../../tasks/unclaim-task.ts';
import { taskProcedure } from './procedure.ts';

export const unclaimTaskProcedure = taskProcedure
    .input(taskMutationInputSchema)
    .output(taskMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await unclaimTask(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return { eventCursor: result.event?.cursor ?? null, task: result.task };
    });
