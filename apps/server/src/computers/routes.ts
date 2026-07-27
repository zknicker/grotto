import { hostedRunnerMintRequestSchema, hostedRunnerRevokeRequestSchema } from '@tavern/api';
import type { FastifyInstance } from 'fastify';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    beginComputerSetupSchema,
    computerSetupStatusSchema,
    validateComputerCredentialSchema,
} from './contracts.ts';
import { mintRunnerCredential, revokeRunnerCredential } from './runner-credentials.ts';
import {
    beginComputerSetup,
    ComputerSetupDeniedError,
    readComputerSetupStatus,
    validateComputerCredential,
} from './service.ts';

export function registerComputerRoutes(
    app: FastifyInstance,
    options: { appOrigin: string; db: GrottoDatabase }
) {
    app.post('/computer/setup', async (request, reply) => {
        try {
            const input = beginComputerSetupSchema.parse(request.body);
            const setup = await beginComputerSetup(options.db, input);
            const approvalUrl = new URL('/computer/approve', options.appOrigin);
            approvalUrl.searchParams.set('approval', setup.approvalId);
            approvalUrl.searchParams.set('secret', setup.secret);
            return {
                approvalId: setup.approvalId,
                approvalUrl: approvalUrl.toString(),
                serverId: setup.serverId,
            };
        } catch (cause) {
            return setupError(reply, cause);
        }
    });
    app.get('/computer/setup/:approvalId', async (request, reply) => {
        try {
            const query = request.query as { secret?: string };
            const input = computerSetupStatusSchema.parse({
                approvalId: (request.params as { approvalId?: string }).approvalId,
                secret: query.secret,
            });
            return await readComputerSetupStatus(options.db, input);
        } catch (cause) {
            return setupError(reply, cause);
        }
    });
    app.post('/computer/validate', async (request, reply) => {
        try {
            const input = validateComputerCredentialSchema.parse(request.body);
            return await validateComputerCredential(options.db, input);
        } catch (cause) {
            return setupError(reply, cause);
        }
    });
    app.post('/computer/runner/mint', async (request, reply) => {
        try {
            const input = hostedRunnerMintRequestSchema.parse(request.body);
            return await mintRunnerCredential(options.db, input);
        } catch (cause) {
            return setupError(reply, cause);
        }
    });
    app.post('/computer/runner/revoke', async (request, reply) => {
        try {
            const input = hostedRunnerRevokeRequestSchema.parse(request.body);
            return await revokeRunnerCredential(options.db, input);
        } catch (cause) {
            return setupError(reply, cause);
        }
    });
}

function setupError(
    reply: { code(statusCode: number): { send(payload: unknown): unknown } },
    cause: unknown
) {
    const message = cause instanceof Error ? cause.message : 'Computer request was rejected.';
    const status = cause instanceof ComputerSetupDeniedError ? 403 : 400;
    return reply.code(status).send({ error: message });
}
