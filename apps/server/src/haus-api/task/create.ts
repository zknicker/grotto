import { taskCreateInputSchema, taskPromotionSchema } from '@haus/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { createTask } from '../../tasks/create-task.ts';
import { taskProcedure } from './procedure.ts';

export const createTaskProcedure = taskProcedure
    .input(taskCreateInputSchema)
    .output(taskPromotionSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await createTask(ctx.hausDb, ctx.member, input, ctx.agentDelivery);

        for (const event of result.events) {
            emitDurableChatEvent({ audienceUserId: null, event });
        }
        await ctx.postCommitWork.wakeAgents(ctx.agentDelivery, result.wakes);

        return { idempotent: result.idempotent, task: result.task };
    });
