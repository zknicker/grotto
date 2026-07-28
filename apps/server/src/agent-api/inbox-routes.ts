import type { FastifyInstance } from 'fastify';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { authorizeAgentRunner, sendAgentApiError, sendAgentReadError } from './auth.ts';
import { inspectAgentInbox, pullAgentEvents } from './inbox.ts';

export function registerAgentInboxRoutes(app: FastifyInstance, db: GrottoDatabase) {
    app.get('/api/agent/events', async (request, reply) => {
        const runner = await authorizeAgentRunner(db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }
        try {
            return await pullAgentEvents(db, runner);
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });
    app.get('/api/agent/inbox', async (request, reply) => {
        const runner = await authorizeAgentRunner(db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }
        try {
            return await inspectAgentInbox(db, runner);
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });
}
