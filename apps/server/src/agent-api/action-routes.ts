import { agentActionPrepareInputSchema } from '@grotto/api';
import type { FastifyInstance } from 'fastify';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import { readAvatarBytes } from '../avatars/avatar-bytes.ts';
import { AvatarRejectedError } from '../avatars/avatar-errors.ts';
import { ChatArchivedError } from '../chats/chat-access.ts';
import { emitDurableChatEvent } from '../chats/durable-events.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    PreparedActionConflictError,
    PreparedActionStaleViewError,
    prepareAgentAction,
} from '../prepared-actions/prepare.ts';
import { authorizeAgentRunner, sendAgentApiError } from './auth.ts';
import { AgentTargetError } from './resolve-target.ts';

export function registerAgentActionRoutes(
    app: FastifyInstance,
    dependencies: { agentDelivery: AgentDelivery; db: GrottoDatabase }
) {
    app.post('/api/agent/actions/prepare', async (request, reply) => {
        const runner = await authorizeAgentRunner(dependencies.db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }

        const parsed = agentActionPrepareInputSchema.safeParse(request.body);
        if (!parsed.success) {
            return sendAgentApiError(
                reply,
                400,
                'INVALID_ARG',
                'The prepared action request was invalid.'
            );
        }

        let avatar: ReturnType<typeof readAvatarBytes>;
        try {
            avatar = readAvatarBytes(parsed.data.avatar.bytesBase64, parsed.data.avatar.mediaType);
        } catch (cause) {
            if (cause instanceof AvatarRejectedError) {
                return sendAgentApiError(reply, 400, 'INVALID_ARG', cause.message);
            }
            throw cause;
        }

        try {
            const committed = await prepareAgentAction(
                dependencies.db,
                runner,
                {
                    action: parsed.data.action,
                    avatar: {
                        bytes: avatar.bytes,
                        mediaType: parsed.data.avatar.mediaType,
                    },
                    nonce: parsed.data.nonce,
                    target: parsed.data.target,
                },
                dependencies.agentDelivery
            );

            for (const event of committed.events) {
                emitDurableChatEvent({ audienceUserId: null, event });
            }
            await Promise.all(
                committed.wakes.map((wake) =>
                    dependencies.agentDelivery
                        .dispatchAgent(wake.agentId, wake.serverId)
                        .catch(() => undefined)
                )
            );
            return committed.receipt;
        } catch (cause) {
            if (cause instanceof PreparedActionConflictError) {
                return sendAgentApiError(reply, 409, 'ACTION_IDEMPOTENCY_CONFLICT', cause.message);
            }
            if (cause instanceof PreparedActionStaleViewError) {
                return sendAgentApiError(reply, 409, cause.code, cause.message, {
                    nextAction: `Run grotto message read --target "${parsed.data.target}" before preparing again.`,
                });
            }
            if (cause instanceof AgentTargetError) {
                return sendAgentApiError(reply, 404, 'INVALID_TARGET', cause.message);
            }
            if (cause instanceof ChatArchivedError) {
                return sendAgentApiError(reply, 409, 'TARGET_READ_ONLY', cause.message);
            }
            return sendAgentApiError(
                reply,
                500,
                'SERVER_5XX',
                'The Server could not prepare the action.'
            );
        }
    });
}
