import { hostedTaskMutationInputSchema, hostedTaskMutationSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { claimHostedTask } from '../../tasks/claim-task.ts';
import { taskProcedure } from './procedure.ts';

export const claimTaskProcedure = taskProcedure
    .input(hostedTaskMutationInputSchema)
    .output(hostedTaskMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await claimHostedTask(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return { eventCursor: result.event?.cursor ?? null, task: result.task };
    });
