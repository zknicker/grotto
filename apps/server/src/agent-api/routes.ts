import { hostedAgentSendInputSchema } from '@tavern/api';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { emitDurableChatEvent } from '../chats/durable-events.ts';
import { AgentSendConflictError, sendHostedAgentMessage } from '../chats/send-agent-message.ts';
import { resolveRunnerCredential } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';

/**
 * The hosted agent surface behind the Computer's loopback proxy. A managed
 * Agent's `grotto message send` reaches here with the scoped runner token the
 * Computer minted; the token fixes the author and channel, so this route trusts
 * neither an agent id nor a chat id from the request body.
 */
export function registerAgentApiRoutes(app: FastifyInstance, options: { db: GrottoDatabase }) {
    app.post('/api/agent/messages/send', async (request, reply) => {
        const runner = await authorizeRunner(options.db, request);
        if (!runner) {
            return sendError(reply, 401, 'MISSING_TOKEN', 'A valid runner credential is required.');
        }

        const parsed = hostedAgentSendInputSchema.safeParse(request.body);
        if (!parsed.success) {
            return sendError(reply, 400, 'INVALID_ARG', 'The message send request was invalid.');
        }

        try {
            const result = await sendHostedAgentMessage(options.db, {
                agentId: runner.agentId,
                chatId: runner.chatId,
                content: parsed.data.content,
                nonce: parsed.data.nonce,
                serverId: runner.serverId,
                target: parsed.data.target,
            });
            if (result.event) {
                emitDurableChatEvent({ audienceUserId: null, event: result.event });
            }
            return { receipt: result.receipt, state: 'sent' as const };
        } catch (cause) {
            if (cause instanceof AgentSendConflictError) {
                return sendError(reply, 409, 'SEND_FAILED', cause.message);
            }
            return sendError(reply, 500, 'SERVER_5XX', 'The Server could not record the message.');
        }
    });
}

async function authorizeRunner(db: GrottoDatabase, request: FastifyRequest) {
    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    const token = typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : null;
    if (!token) {
        return null;
    }
    return await resolveRunnerCredential(db, token);
}

function sendError(reply: FastifyReply, status: number, code: string, message: string) {
    return reply.code(status).send({ code, message });
}
