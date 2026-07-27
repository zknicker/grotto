import { hostedTaskMutationInputSchema, hostedTaskMutationSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { unclaimHostedTask } from '../../tasks/unclaim-task.ts';
import { taskProcedure } from './procedure.ts';

export const unclaimTaskProcedure = taskProcedure
    .input(hostedTaskMutationInputSchema)
    .output(hostedTaskMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await unclaimHostedTask(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return { eventCursor: result.event?.cursor ?? null, task: result.task };
    });
