import { chatSchema, ensureAgentDmInputSchema } from '@grotto/api';
import { TRPCError } from '@trpc/server';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { AgentDmPeerNotFoundError, ensureAgentDmRecord } from '../../chats/ensure-agent-dm.ts';
import { insertLifecycleEvent } from '../../chats/lifecycle-events.ts';
import { listChats } from '../../chats/list-chats.ts';
import { chatProcedure } from './procedure.ts';

export const ensureAgentDmProcedure = chatProcedure
    .input(ensureAgentDmInputSchema)
    .output(chatSchema)
    .mutation(async ({ ctx, input }) => {
        if (!ctx.member) {
            throw new TRPCError({ code: 'UNAUTHORIZED' });
        }
        try {
            const ensured = await ctx.grottoDb.transaction(async (tx) => {
                const chat = await ensureAgentDmRecord(tx, {
                    ...input,
                    userId: ctx.member!.id,
                });
                const event = chat.created
                    ? await insertLifecycleEvent(
                          tx,
                          { chatId: chat.id, serverId: input.serverId },
                          'created',
                          new Date()
                      )
                    : null;
                return { chat, event };
            });
            const visible = (await listChats(ctx.grottoDb, ctx.member, input.serverId)).find(
                (candidate) => candidate.id === ensured.chat.id
            );
            if (!visible) {
                throw new Error('Failed to open the Agent DM after creating it.');
            }
            if (ensured.event) {
                emitDurableChatEvent({ audienceUserId: null, event: ensured.event });
            }
            return visible;
        } catch (cause) {
            if (cause instanceof AgentDmPeerNotFoundError) {
                throw new TRPCError({ cause, code: 'NOT_FOUND', message: cause.message });
            }
            throw cause;
        }
    });
