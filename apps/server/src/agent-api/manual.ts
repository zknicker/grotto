import { getManualTopic, searchManualTopics } from '@grotto/agent-manual';
import {
    agentManualGetQuerySchema,
    agentManualGetResponseSchema,
    agentManualSearchQuerySchema,
    agentManualSearchResponseSchema,
    manualRunnerCapability,
} from '@grotto/api';
import type { FastifyInstance } from 'fastify';
import type * as z from 'zod';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentManualLookupAuditTable } from '../postgres/schema.ts';
import { authorizeAgentRunner, sendAgentApiError } from './auth.ts';

export class ManualTopicNotFoundError extends Error {
    constructor(readonly topicId: string) {
        super(`Manual topic '${topicId}' was not found.`);
        this.name = 'ManualTopicNotFoundError';
    }
}

export function registerAgentManualRoutes(app: FastifyInstance, db: GrottoDatabase) {
    app.get('/api/agent/manual/get', async (request, reply) => {
        const runner = await authorizeAgentRunner(db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }
        if (!runner.capabilities.includes(manualRunnerCapability)) {
            return sendAgentApiError(
                reply,
                403,
                'MANUAL_CAPABILITY_REQUIRED',
                'This runner is not authorized to read the Grotto Manual.'
            );
        }
        const parsed = agentManualGetQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return sendAgentApiError(
                reply,
                400,
                'MANUAL_INVALID_METADATA',
                'Manual intent and reason must each be 12–500 characters.'
            );
        }
        try {
            return await readManualTopic(db, runner, parsed.data);
        } catch (cause) {
            if (cause instanceof ManualTopicNotFoundError) {
                return sendAgentApiError(reply, 404, 'MANUAL_TOPIC_NOT_FOUND', cause.message, {
                    nextAction: "Run 'grotto manual get index' to browse available topics.",
                });
            }
            return sendAgentApiError(
                reply,
                500,
                'SERVER_5XX',
                'The Server could not read the Manual.'
            );
        }
    });

    app.get('/api/agent/manual/search', async (request, reply) => {
        const runner = await authorizeAgentRunner(db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }
        if (!runner.capabilities.includes(manualRunnerCapability)) {
            return sendAgentApiError(
                reply,
                403,
                'MANUAL_CAPABILITY_REQUIRED',
                'This runner is not authorized to read the Grotto Manual.'
            );
        }
        const parsed = agentManualSearchQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return sendAgentApiError(
                reply,
                400,
                'MANUAL_INVALID_METADATA',
                'Manual intent and reason must each be 12–500 characters.'
            );
        }
        try {
            return await searchManual(db, runner, parsed.data);
        } catch {
            return sendAgentApiError(
                reply,
                500,
                'SERVER_5XX',
                'The Server could not read the Manual.'
            );
        }
    });
}

async function readManualTopic(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: z.infer<typeof agentManualGetQuerySchema>
) {
    await recordManualLookup(db, runner, {
        intent: input.intent,
        operation: 'get',
        reason: input.reason,
        topicId: input.topic,
    });
    const topic = getManualTopic(input.topic);
    if (!topic) {
        throw new ManualTopicNotFoundError(input.topic);
    }
    return agentManualGetResponseSchema.parse({ topic });
}

async function searchManual(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: z.infer<typeof agentManualSearchQuerySchema>
) {
    await recordManualLookup(db, runner, {
        intent: input.intent,
        operation: 'search',
        query: input.q,
        reason: input.reason,
    });
    const results = searchManualTopics(input.q, { limit: input.limit, scope: input.scope }).map(
        ({ body: _body, related: _related, ...result }) => result
    );
    return agentManualSearchResponseSchema.parse({
        query: input.q,
        results,
        scope: input.scope,
    });
}

async function recordManualLookup(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: {
        intent: string;
        operation: 'get' | 'search';
        query?: string;
        reason: string;
        topicId?: string;
    }
) {
    await db.insert(agentManualLookupAuditTable).values({
        agentId: runner.agentId,
        id: createOpaqueId('aml'),
        intent: input.intent,
        operation: input.operation,
        query: input.query ?? null,
        reason: input.reason,
        runId: runner.runId,
        runnerId: runner.runnerId,
        serverId: runner.serverId,
        topicId: input.topicId ?? null,
    });
}
