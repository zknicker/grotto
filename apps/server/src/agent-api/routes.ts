import { hostedAgentSendInputSchema } from '@tavern/api';
import type { FastifyInstance } from 'fastify';
import * as z from 'zod';
import { publishAgentLifecycle } from '../agent-delivery/lifecycle.ts';
import type { AttachmentRoot } from '../attachments/attachment-root.ts';
import { emitDurableChatEvent } from '../chats/durable-events.ts';
import { AgentSendConflictError, sendHostedAgentMessage } from '../chats/send-agent-message.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { registerAgentAttachmentRoutes } from './attachment-routes.ts';
import { changeAgentChannelMute, unfollowAgentThread } from './attention.ts';
import { authorizeAgentRunner, sendAgentApiError, sendAgentReadError } from './auth.ts';
import {
    changeAgentChannelMembership,
    readAgentChannelInfo,
    readAgentChannelMembers,
    readAgentServerDirectory,
} from './directory.ts';
import { registerAgentInboxRoutes } from './inbox-routes.ts';
import { registerAgentMcpRoutes } from './mcp-routes.ts';
import { readAgentHistory, resolveAgentMessage, searchAgentMessages } from './message-read.ts';
import { readAgentProfile, updateAgentProfile } from './profile.ts';
import { registerAgentReactionRoutes } from './reaction-routes.ts';
import { registerAgentReminderRoutes } from './reminder-routes.ts';
import { AgentTargetError, resolveAgentSendTarget } from './resolve-target.ts';
import { AgentSendModeError, clearAgentDraft, prepareAgentSend } from './send-hold.ts';
import { registerAgentTaskRoutes } from './task-routes.ts';

const historyQuerySchema = z.object({
    after: z.string().min(1).optional(),
    around: z.string().min(1).optional(),
    before: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    target: z.string().min(1),
});
const searchQuerySchema = z.object({
    after: z.coerce.date().optional(),
    before: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
    q: z.string().trim().min(1).max(500),
    sender: z.string().trim().min(1).max(128).optional(),
    sort: z.enum(['recent', 'relevance']).default('relevance'),
    target: z.string().trim().min(1).max(200).optional(),
});
const directoryQuerySchema = z.object({
    agents: z.coerce.boolean().default(false),
    channels: z.coerce.boolean().default(false),
    humans: z.coerce.boolean().default(false),
    joined: z.coerce.boolean().default(false),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
    query: z.string().trim().min(1).max(200).optional(),
});
const targetQuerySchema = z.object({ target: z.string().trim().min(1).max(200) });

/**
 * The hosted agent surface behind the Computer's loopback proxy. A managed
 * Agent's `grotto message send` reaches here with the scoped runner token the
 * Computer minted. The token fixes the author and Server; this route resolves
 * the product target and access Server-side and trusts no chat id from the body.
 */
export function registerAgentApiRoutes(
    app: FastifyInstance,
    options: {
        agentDelivery: import('../agent-delivery/delivery.ts').AgentDelivery;
        attachmentRoot: AttachmentRoot;
        db: GrottoDatabase;
        mcpRuntime: import('../hosted-mcp/runtime.ts').HostedMcpRuntime;
    }
) {
    registerAgentAttachmentRoutes(app, { db: options.db, root: options.attachmentRoot });
    registerAgentInboxRoutes(app, options.db);
    registerAgentMcpRoutes(app, { db: options.db, runtime: options.mcpRuntime });
    registerAgentReactionRoutes(app, options.db);
    registerAgentReminderRoutes(app, options.db);
    registerAgentTaskRoutes(app, options.db);

    app.get('/api/agent/profile', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        const parsed = z.object({ target: z.string().optional() }).safeParse(request.query);
        if (!(runner && parsed.success)) {
            return sendAgentApiError(reply, 400, 'INVALID_ARG', 'The profile request was invalid.');
        }
        try {
            return await readAgentProfile(options.db, runner, parsed.data.target);
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });

    app.post('/api/agent/profile/update', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        const parsed = z
            .object({ description: z.string().trim().min(1).max(500) })
            .safeParse(request.body);
        if (!(runner && parsed.success)) {
            return sendAgentApiError(reply, 400, 'INVALID_ARG', 'The profile request was invalid.');
        }
        try {
            return await updateAgentProfile(options.db, runner, parsed.data.description);
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });

    app.get('/api/agent/server', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }
        const parsed = directoryQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return sendAgentApiError(
                reply,
                400,
                'INVALID_ARG',
                'The directory request was invalid.'
            );
        }
        return await readAgentServerDirectory(options.db, runner, parsed.data);
    });

    app.get('/api/agent/channels/info', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        const parsed = targetQuerySchema.safeParse(request.query);
        if (!(runner && parsed.success)) {
            return sendAgentApiError(reply, 400, 'INVALID_ARG', 'The channel request was invalid.');
        }
        try {
            return await readAgentChannelInfo(options.db, runner, parsed.data.target);
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });

    app.get('/api/agent/channels/members', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        const parsed = targetQuerySchema.safeParse(request.query);
        if (!(runner && parsed.success)) {
            return sendAgentApiError(reply, 400, 'INVALID_ARG', 'The channel request was invalid.');
        }
        try {
            return await readAgentChannelMembers(options.db, runner, parsed.data.target);
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });

    for (const action of ['join', 'leave'] as const) {
        app.post(`/api/agent/channels/${action}`, async (request, reply) => {
            const runner = await authorizeAgentRunner(options.db, request);
            const parsed = targetQuerySchema.safeParse(request.body);
            if (!(runner && parsed.success)) {
                return sendAgentApiError(
                    reply,
                    400,
                    'INVALID_ARG',
                    'The channel request was invalid.'
                );
            }
            try {
                return await changeAgentChannelMembership(
                    options.db,
                    runner,
                    parsed.data.target,
                    action
                );
            } catch (cause) {
                return sendAgentReadError(reply, cause);
            }
        });
    }

    for (const action of ['mute', 'unmute'] as const) {
        app.post(`/api/agent/channels/${action}`, async (request, reply) => {
            const runner = await authorizeAgentRunner(options.db, request);
            const parsed = targetQuerySchema.safeParse(request.body);
            if (!(runner && parsed.success)) {
                return sendAgentApiError(
                    reply,
                    400,
                    'INVALID_ARG',
                    'The channel request was invalid.'
                );
            }
            try {
                return await changeAgentChannelMute(
                    options.db,
                    runner,
                    parsed.data.target,
                    action === 'mute'
                );
            } catch (cause) {
                return sendAgentReadError(reply, cause);
            }
        });
    }

    app.post('/api/agent/threads/unfollow', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        const parsed = targetQuerySchema.safeParse(request.body);
        if (!(runner && parsed.success)) {
            return sendAgentApiError(reply, 400, 'INVALID_ARG', 'The thread request was invalid.');
        }
        try {
            return await unfollowAgentThread(options.db, runner, parsed.data.target);
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });

    app.get('/api/agent/history', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }
        const parsed = historyQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return sendAgentApiError(reply, 400, 'INVALID_ARG', 'The history request was invalid.');
        }
        try {
            return await readAgentHistory(options.db, runner, parsed.data);
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });

    app.get('/api/agent/messages/search', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }
        const parsed = searchQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return sendAgentApiError(reply, 400, 'INVALID_ARG', 'The search request was invalid.');
        }
        try {
            return {
                messages: await searchAgentMessages(options.db, runner, {
                    ...parsed.data,
                    query: parsed.data.q,
                }),
            };
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });

    app.get('/api/agent/messages/:id', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }
        const parsed = z.object({ id: z.string().min(1).max(200) }).safeParse(request.params);
        if (!parsed.success) {
            return sendAgentApiError(reply, 400, 'INVALID_ARG', 'The message id was invalid.');
        }
        try {
            return { message: await resolveAgentMessage(options.db, runner, parsed.data.id) };
        } catch (cause) {
            return sendAgentReadError(reply, cause);
        }
    });

    app.post('/api/agent/messages/send', async (request, reply) => {
        const runner = await authorizeAgentRunner(options.db, request);
        if (!runner) {
            return sendAgentApiError(
                reply,
                401,
                'MISSING_TOKEN',
                'A valid runner credential is required.'
            );
        }

        const parsed = hostedAgentSendInputSchema.safeParse(request.body);
        if (!parsed.success) {
            return sendAgentApiError(
                reply,
                400,
                'INVALID_ARG',
                'The message send request was invalid.'
            );
        }

        try {
            const committed = await options.db.transaction(async (tx) => {
                await lockServerRow(tx, runner.serverId);
                const chatId = await resolveAgentSendTarget(tx, runner, parsed.data.target);
                const prepared = await prepareAgentSend(tx, runner, chatId, parsed.data);
                if (prepared.kind === 'held') {
                    return { kind: 'held' as const, response: prepared.response };
                }
                const result = await sendHostedAgentMessage(
                    tx,
                    {
                        agentId: runner.agentId,
                        attachmentIds: prepared.outgoing.attachmentIds,
                        chatId,
                        content: prepared.outgoing.content,
                        nonce: parsed.data.nonce,
                        serverId: runner.serverId,
                        target: parsed.data.target,
                    },
                    options.agentDelivery
                );
                await clearAgentDraft(tx, runner, chatId);
                return { chatId, kind: 'sent' as const, result };
            });
            if (committed.kind === 'held') {
                return committed.response;
            }
            const { chatId, result } = committed;
            publishAgentLifecycle({
                agentId: runner.agentId,
                chatId,
                compositionId: parsed.data.compositionId ?? runner.runId,
                phase: 'sending',
                runId: runner.runId,
                serverId: runner.serverId,
                text: result.message.content,
            });
            publishAgentLifecycle({
                agentId: runner.agentId,
                chatId,
                phase: 'working',
                runId: runner.runId,
                serverId: runner.serverId,
            });
            if (result.event) {
                emitDurableChatEvent({ audienceUserId: null, event: result.event });
            }
            await Promise.all(
                result.wakes.map((wake) =>
                    options.agentDelivery
                        .dispatchAgent(wake.agentId, wake.serverId)
                        .catch(() => undefined)
                )
            );
            return { message: result.message, recentUnread: [], state: 'sent' as const };
        } catch (cause) {
            if (cause instanceof AgentSendConflictError) {
                return sendAgentApiError(reply, 409, 'SEND_FAILED', cause.message);
            }
            if (cause instanceof AgentSendModeError) {
                return sendAgentApiError(reply, cause.status, cause.code, cause.message);
            }
            if (cause instanceof AgentTargetError) {
                return sendAgentApiError(reply, 404, 'INVALID_TARGET', cause.message);
            }
            return sendAgentApiError(
                reply,
                500,
                'SERVER_5XX',
                'The Server could not record the message.'
            );
        }
    });
}
