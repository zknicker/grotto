import type { FastifyInstance } from 'fastify';
import * as z from 'zod';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { authorizeAgentRunner, sendAgentApiError, sendAgentReadError } from './auth.ts';
import { changeAgentReaction } from './reactions.ts';

export function registerAgentReactionRoutes(app: FastifyInstance, db: GrottoDatabase) {
    app.post('/api/agent/messages/react', async (request, reply) => {
        const runner = await authorizeAgentRunner(db, request);
        const parsed = z
            .object({
                emoji: z.string().trim().min(1).max(64),
                messageId: z.string().trim().min(1).max(200),
                remove: z.boolean().default(false),
            })
            .strict()
            .safeParse(request.body);
        if (!(runner && parsed.success)) {
            return sendAgentApiError(
                reply,
                400,
                'INVALID_ARG',
                'The reaction request was invalid.'
            );
        }
        try {
            return await changeAgentReaction(db, runner, parsed.data);
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });
}
