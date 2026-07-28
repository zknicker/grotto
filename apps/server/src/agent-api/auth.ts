import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolveRunnerCredential } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { AgentTargetError } from './resolve-target.ts';
import { AgentTaskError } from './tasks.ts';

export async function authorizeAgentRunner(db: GrottoDatabase, request: FastifyRequest) {
    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    const token = typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : null;
    return token ? await resolveRunnerCredential(db, token) : null;
}

export function sendAgentApiError(
    reply: FastifyReply,
    status: number,
    code: string,
    message: string
) {
    return reply.code(status).send({ code, message });
}

export function sendAgentReadError(reply: FastifyReply, cause: unknown) {
    if (cause instanceof AgentTargetError) {
        return sendAgentApiError(reply, 404, 'INVALID_TARGET', cause.message);
    }
    if (cause instanceof AgentTaskError) {
        return sendAgentApiError(reply, 409, 'TASK_CONFLICT', cause.message);
    }
    return sendAgentApiError(reply, 500, 'SERVER_5XX', 'The Server could not read messages.');
}
