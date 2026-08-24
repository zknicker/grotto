import { taskAssignInputSchema, taskMutationSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { assignTask } from '../../tasks/assign-task.ts';
import { taskProcedure } from './procedure.ts';

export const assignTaskProcedure = taskProcedure
    .input(taskAssignInputSchema)
    .output(taskMutationSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await assignTask(ctx.grottoDb, ctx.member, ctx.agentDelivery, input);

        for (const event of result.events) {
            emitDurableChatEvent({ audienceUserId: null, event });
        }
        // Waking the assignee is what turns a reservation into work: the Agent
        // comes up, claims the task, and starts.
        await Promise.all(
            result.wakes.map((agentId) =>
                ctx.agentDelivery.dispatchAgent(agentId, input.serverId).catch(() => undefined)
            )
        );

        // The task update is the cursor clients resume from; the receipt is
        // private Agent traffic they never render.
        return { eventCursor: result.events[0]?.cursor ?? null, task: result.task };
    });
