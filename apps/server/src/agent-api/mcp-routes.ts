import type { FastifyInstance } from 'fastify';
import * as z from 'zod';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { McpDeniedError, McpUpstreamError } from '../server-mcp/errors.ts';
import type { McpRuntime } from '../server-mcp/runtime.ts';
import { authorizeAgentRunner, sendAgentApiError } from './auth.ts';

const invocationSchema = z
    .object({
        args: z.unknown(),
        toolName: z.string().trim().min(1).max(256),
    })
    .strict();

export function registerAgentMcpRoutes(
    app: FastifyInstance,
    options: { db: GrottoDatabase; runtime: McpRuntime }
) {
    app.get('/api/agent/mcp/tools', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }
        try {
            return {
                tools: await options.runtime.listAgentTools(runner.serverId, runner.agentId),
            };
        } catch (cause) {
            return sendAgentApiError(
                reply,
                502,
                'MCP_UNAVAILABLE',
                cause instanceof Error ? cause.message : 'MCP tools are unavailable.'
            );
        }
    });

    app.post('/api/agent/mcp/invoke', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        const parsed = invocationSchema.safeParse(request.body);
        if (!(runner && parsed.success)) {
            return sendAgentApiError(reply, 400, 'INVALID_ARG', 'The MCP invocation was invalid.');
        }
        try {
            return {
                result: await options.runtime.invoke({
                    agentId: runner.agentId,
                    args: parsed.data.args,
                    serverId: runner.serverId,
                    toolName: parsed.data.toolName,
                }),
            };
        } catch (cause) {
            if (cause instanceof McpDeniedError) {
                return sendAgentApiError(reply, 403, cause.code, cause.message);
            }
            if (cause instanceof McpUpstreamError) {
                return sendAgentApiError(
                    reply,
                    cause.code === 'MCP_TIMEOUT' ? 504 : 502,
                    cause.code,
                    cause.message
                );
            }
            return sendAgentApiError(
                reply,
                502,
                'MCP_UNAVAILABLE',
                cause instanceof Error ? cause.message : 'MCP invocation is unavailable.'
            );
        }
    });
}
