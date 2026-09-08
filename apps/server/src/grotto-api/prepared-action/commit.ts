import { preparedActionCommitInputSchema, preparedActionCommitResultSchema } from '@grotto/api';
import { TRPCError } from '@trpc/server';
import { AvatarRejectedError } from '../../avatars/avatar-errors.ts';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { commitPreparedAction } from '../../prepared-actions/commit.ts';
import { PreparedActionCommitError } from '../../prepared-actions/commit-errors.ts';
import { AgentConfigDeniedError } from '../../server-agents/agent-config-errors.ts';
import { memberProcedure } from '../server/procedure.ts';
import { emitServerUpdated } from '../server-events.ts';

export const commitPreparedActionProcedure = memberProcedure
    .input(preparedActionCommitInputSchema)
    .output(preparedActionCommitResultSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            const result = await commitPreparedAction(ctx.grottoDb, ctx.member, input);

            if (result.event) {
                emitDurableChatEvent({ audienceUserId: null, event: result.event });
            }
            emitServerUpdated({
                agentId: result.agent.id,
                scope: 'agent',
                serverId: input.serverId,
            });

            if (!result.idempotent) {
                void ctx.postCommitWork.run('agent.configure-after-action-commit', () =>
                    ctx.agentDelivery.configureAgent({
                        agentDescription: result.agent.description,
                        agentId: result.agent.id,
                        agentName: result.agent.displayName,
                        computerId: result.agent.computerId,
                        modelId: result.agent.desiredModelId,
                        reasoningEffort: result.agent.desiredReasoningEffort,
                        runtimeId: result.agent.desiredRuntimeId,
                    })
                );
                void ctx.postCommitWork.wakeAgents(ctx.agentDelivery, [
                    { agentId: result.action.proposerAgentId, serverId: input.serverId },
                ]);
            }

            return {
                action: result.action,
                agent: result.agent,
                idempotent: result.idempotent,
            };
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            if (cause instanceof AvatarRejectedError) {
                throw new TRPCError({ cause, code: 'BAD_REQUEST', message: cause.message });
            }
            if (cause instanceof PreparedActionCommitError) {
                throw new TRPCError({ cause, code: 'CONFLICT', message: cause.message });
            }
            throw cause;
        }
    });
