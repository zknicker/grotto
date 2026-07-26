import { hostedCompositionPublishedSchema, hostedCompositionPublishInputSchema } from '@tavern/api';
import { requireChatAccess } from '../../chats/chat-access.ts';
import { publishChatComposition } from '../../chats/composition-hub.ts';
import { chatProcedure } from './procedure.ts';

export const publishCompositionProcedure = chatProcedure
    .input(hostedCompositionPublishInputSchema)
    .output(hostedCompositionPublishedSchema)
    .mutation(async ({ ctx, input }) => {
        await requireChatAccess(ctx.grottoDb, ctx.member, input);

        if (!ctx.member) {
            throw new Error('A Server member is required to publish a composition.');
        }

        publishChatComposition({
            actorUserId: ctx.member.id,
            chatId: input.chatId,
            compositionId: input.compositionId,
            emittedAt: new Date().toISOString(),
            serverId: input.serverId,
            text: input.text,
        });
        return { accepted: true as const };
    });
