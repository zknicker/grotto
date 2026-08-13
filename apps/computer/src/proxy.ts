import * as z from 'zod';
import type { ComputerAgentActivityUpdate } from './agent-activity.ts';
import {
    agentHistoryResponseSchema,
    agentMessageCheckResponseSchema,
    agentMessageSchema,
    agentReactionResponseSchema,
    agentSearchResponseSchema,
    agentSendResponseSchema,
    resolvedAgentMessageSchema,
} from './agent-cli/agent-api-schemas.ts';
import {
    createLocalAgentSkill,
    deleteLocalAgentSkill,
    listLocalAgentSkills,
    patchLocalAgentSkill,
    viewLocalAgentSkill,
    writeLocalAgentSkillFile,
} from './agent-skills.ts';
import { classifyGrottoProxyBoundary } from './harness/activity-projector.ts';
import {
    type AgentInboxLocation,
    consumeVisibleMessages,
    readPendingInboxState,
    recordRunVisibleMessages,
    type VisibleMessageIdentity,
} from './inbox-store.ts';

const skillCreateSchema = z.object({
    content: z.string().min(1),
    description: z.string().trim().min(1),
    name: z.string().trim().min(1),
});
const skillPatchSchema = z.object({
    content: z.string().min(1),
    expectedHash: z.string().min(1),
    skillId: z.string().min(1),
});
const skillFileSchema = z.object({
    content: z.string(),
    expectedHash: z.string().min(1).nullable(),
    filePath: z.string().min(1),
    skillId: z.string().min(1),
});

export interface LoopbackProxy {
    clearRunnerToken(): void;
    close(): void;
    resetSendCount(): void;
    sendCount(): number;
    setActivitySink(sink: ((activity: ComputerAgentActivityUpdate) => void) | undefined): void;
    setRunId(runId: string): void;
    setRunnerToken(token: string): void;
    url: string;
}

/**
 * The per-launch loopback proxy. The Agent authenticates to it with a local-only
 * token; the proxy forwards `/api/agent/*` to the Server with the scoped
 * runner credential. The runner credential never leaves this process, so the
 * Agent can act as itself without ever holding Server-valid authority.
 */
export function startLoopbackProxy(input: {
    agentId?: string;
    dataRoot?: string;
    proxyToken: string;
    runnerToken: string;
    runId?: string;
    serverId?: string;
    serverOrigin: string;
    skillsDir?: string;
    onActivity?: (activity: ComputerAgentActivityUpdate) => void;
}): LoopbackProxy {
    let sends = 0;
    let runnerToken: string | null = input.runnerToken;
    let runId: string | null = input.runId ?? null;
    let activitySink = input.onActivity;
    const server = Bun.serve({
        fetch: async (request) => {
            const url = new URL(request.url);
            if (!url.pathname.startsWith('/api/agent/')) {
                return new Response('Not found', { status: 404 });
            }
            if (!isAuthorized(request, input.proxyToken)) {
                return new Response('Unauthorized', { status: 401 });
            }
            const category = classifyGrottoProxyBoundary(request.method, url.pathname);
            if (!category) {
                return await handleAuthorizedProxyRequest(request, url, input, {
                    getRunId: () => runId,
                    getRunnerToken: () => runnerToken,
                    incrementSendCount: () => {
                        sends += 1;
                    },
                });
            }
            activitySink?.({ category, phase: 'started' });
            let completed = false;
            try {
                const response = await handleAuthorizedProxyRequest(request, url, input, {
                    getRunId: () => runId,
                    getRunnerToken: () => runnerToken,
                    incrementSendCount: () => {
                        sends += 1;
                    },
                });
                completed = response.ok;
                return response;
            } finally {
                activitySink?.({ category, phase: completed ? 'completed' : 'failed' });
            }
        },
        hostname: '127.0.0.1',
        port: 0,
    });
    return {
        clearRunnerToken: () => {
            runnerToken = null;
        },
        close: () => server.stop(true),
        resetSendCount: () => {
            sends = 0;
        },
        sendCount: () => sends,
        setActivitySink: (sink) => {
            activitySink = sink;
        },
        setRunId: (value) => {
            runId = value;
        },
        setRunnerToken: (token) => {
            runnerToken = token;
        },
        url: `http://127.0.0.1:${server.port}`,
    };
}

async function handleAuthorizedProxyRequest(
    request: Request,
    url: URL,
    input: {
        agentId?: string;
        dataRoot?: string;
        proxyToken: string;
        runId?: string;
        serverId?: string;
        serverOrigin: string;
        skillsDir?: string;
    },
    state: {
        getRunId(): string | null;
        getRunnerToken(): string | null;
        incrementSendCount(): void;
    }
): Promise<Response> {
    const skillResponse = await handleSkillRequest(request, url, input);
    if (skillResponse) {
        return skillResponse;
    }
    const runnerToken = state.getRunnerToken();
    if (!runnerToken) {
        return Response.json(
            { code: 'AGENT_IDLE', message: 'The Agent has no active turn.' },
            { status: 409 }
        );
    }
    const location = agentInboxLocation(input);
    if (request.method === 'GET' && url.pathname === '/api/agent/events' && location) {
        const local = await localAgentEvents(location);
        if (local) {
            const activeRunId = state.getRunId();
            if (!activeRunId) {
                return Response.json(
                    { code: 'AGENT_IDLE', message: 'The Agent has no active turn.' },
                    { status: 409 }
                );
            }
            await recordRunVisibleMessages(location, activeRunId, local.identities);
            await awaitBestEffortAttestation(input.serverOrigin, runnerToken, local.identities);
            await consumeVisibleMessages(location, local.identities);
            return Response.json({ messages: local.messages, more: local.more });
        }
    }
    const body = await request.text();
    const upstreamUrl = new URL(url.pathname, input.serverOrigin);
    upstreamUrl.search = url.search;
    const isMessageSend = url.pathname === '/api/agent/messages/send';
    const isMessageMutation = isMessageSend || url.pathname === '/api/agent/messages/react';
    let upstream: Response;
    try {
        upstream = await fetch(upstreamUrl, {
            body: request.method === 'GET' ? undefined : body,
            headers: {
                authorization: `Bearer ${runnerToken}`,
                'content-type': request.headers.get('content-type') ?? 'application/json',
            },
            method: request.method,
        });
    } catch (error) {
        // A send may have committed before its response disappeared. Count it
        // conservatively so a failed turn cannot replay duplicate model output.
        if (isMessageSend && !isDefinitelyPreCommitFailure(error)) {
            state.incrementSendCount();
        }
        return Response.json(
            { code: 'UPSTREAM_UNAVAILABLE', message: 'The Server response was unavailable.' },
            { status: 502 }
        );
    }
    const responseBody = await upstream.text();
    if (upstream.ok && isMessageSend && isCommittedSend(responseBody)) {
        state.incrementSendCount();
    }
    const visibleMessageIds = upstream.ok
        ? extractVisibleMessageIds(url.pathname, responseBody)
        : [];
    if (location && visibleMessageIds.length > 0) {
        try {
            const activeRunId = state.getRunId();
            if (activeRunId) {
                await recordRunVisibleMessages(location, activeRunId, visibleMessageIds);
            }
            const attested = activeRunId
                ? await attestLocalEvents(input.serverOrigin, runnerToken, visibleMessageIds)
                : null;
            if (!((activeRunId && attested) || isMessageMutation)) {
                return Response.json(
                    {
                        code: 'VISIBILITY_RECEIPT_UNAVAILABLE',
                        message: 'The Server could not record visible messages.',
                    },
                    { status: 502 }
                );
            }
            await consumeVisibleMessages(location, attested ?? visibleMessageIds);
        } catch {
            if (isMessageMutation) {
                return new Response(responseBody, {
                    headers: { 'content-type': 'application/json' },
                    status: upstream.status,
                });
            }
            return Response.json(
                {
                    code: 'LOCAL_INBOX_UNAVAILABLE',
                    message: 'The Agent inbox could not record visible messages.',
                },
                { status: 500 }
            );
        }
    }
    return new Response(responseBody, {
        headers: { 'content-type': 'application/json' },
        status: upstream.status,
    });
}

async function localAgentEvents(location: AgentInboxLocation) {
    const pending = await readPendingInboxState(location);
    const visible = pending.items
        .map((item) => {
            const message = agentMessageSchema.safeParse(item.message);
            return message.success ? { item, message: message.data } : null;
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
    if (visible.length === 0) {
        return null;
    }
    const selected = visible.slice(0, 40);
    return {
        identities: selected.map(({ message }) => identity(message)),
        messages: selected.map(({ item, message }) => ({ message, target: item.target })),
        more: pending.totalPending > selected.length,
    };
}

async function attestLocalEvents(
    serverOrigin: string,
    runnerToken: string,
    messages: VisibleMessageIdentity[]
): Promise<VisibleMessageIdentity[] | null> {
    const response = await fetch(new URL('/api/agent/events/visible', serverOrigin), {
        body: JSON.stringify({ messages }),
        headers: {
            authorization: `Bearer ${runnerToken}`,
            'content-type': 'application/json',
        },
        method: 'POST',
    }).catch(() => null);
    if (!response?.ok) {
        return null;
    }
    const body = (await response.json().catch(() => null)) as { accepted?: unknown } | null;
    if (!Array.isArray(body?.accepted)) {
        return null;
    }
    const accepted = new Set(body.accepted.filter((id): id is string => typeof id === 'string'));
    return messages.filter((message) => accepted.has(message.id));
}

async function awaitBestEffortAttestation(
    serverOrigin: string,
    runnerToken: string,
    messages: VisibleMessageIdentity[]
): Promise<void> {
    await Promise.race([
        attestLocalEvents(serverOrigin, runnerToken, messages),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 250)),
    ]);
}

function agentInboxLocation(input: {
    agentId?: string;
    dataRoot?: string;
    serverId?: string;
}): AgentInboxLocation | null {
    return input.agentId && input.dataRoot && input.serverId
        ? { agentId: input.agentId, dataRoot: input.dataRoot, serverId: input.serverId }
        : null;
}

function extractVisibleMessageIds(
    pathname: string,
    responseBody: string
): VisibleMessageIdentity[] {
    let body: unknown;
    try {
        body = JSON.parse(responseBody);
    } catch {
        return [];
    }
    if (!(body && typeof body === 'object')) {
        return [];
    }
    if (pathname === '/api/agent/events') {
        const parsed = agentMessageCheckResponseSchema.safeParse(body);
        return parsed.success ? parsed.data.messages.map((row) => identity(row.message)) : [];
    }
    if (pathname === '/api/agent/history') {
        const parsed = agentHistoryResponseSchema.safeParse(body);
        return parsed.success ? parsed.data.messages.map(identity) : [];
    }
    if (pathname === '/api/agent/messages/search') {
        const parsed = agentSearchResponseSchema.safeParse(body);
        return parsed.success ? parsed.data.messages.map(identity) : [];
    }
    if (pathname === '/api/agent/messages/react') {
        const parsed = agentReactionResponseSchema.safeParse(body);
        return parsed.success ? [identity(parsed.data.message)] : [];
    }
    if (pathname === '/api/agent/messages/send') {
        const parsed = agentSendResponseSchema.safeParse(body);
        if (!parsed.success) {
            return [];
        }
        return parsed.data.state === 'held'
            ? parsed.data.shownMessages.map(identity)
            : parsed.data.recentUnread.map((row) => identity(row.message));
    }
    if (/^\/api\/agent\/messages\/[^/]+$/u.test(pathname)) {
        const parsed = resolvedAgentMessageSchema.safeParse(body);
        return parsed.success ? [identity(parsed.data.message)] : [];
    }
    return [];
}

function identity(message: {
    chat_id: string;
    id: string;
    sequence: number;
}): VisibleMessageIdentity {
    return { chatId: message.chat_id, id: message.id, sequence: message.sequence };
}

async function handleSkillRequest(
    request: Request,
    url: URL,
    input: { agentId?: string; skillsDir?: string }
): Promise<Response | null> {
    if (!(input.agentId && input.skillsDir && url.pathname.startsWith('/api/agent/skills'))) {
        return null;
    }
    try {
        if (url.pathname === '/api/agent/skills' && request.method === 'GET') {
            return Response.json(await listLocalAgentSkills(input.skillsDir));
        }
        if (url.pathname === '/api/agent/skills/create' && request.method === 'POST') {
            return Response.json(
                await createLocalAgentSkill(
                    input.skillsDir,
                    skillCreateSchema.parse(await request.json())
                )
            );
        }
        if (url.pathname === '/api/agent/skills/patch' && request.method === 'POST') {
            return Response.json(
                await patchLocalAgentSkill(
                    input.skillsDir,
                    skillPatchSchema.parse(await request.json())
                )
            );
        }
        if (url.pathname === '/api/agent/skills/write-file' && request.method === 'POST') {
            return Response.json(
                await writeLocalAgentSkillFile(
                    input.skillsDir,
                    skillFileSchema.parse(await request.json())
                )
            );
        }
        const skillId = decodeURIComponent(url.pathname.slice('/api/agent/skills/'.length));
        if (skillId && request.method === 'GET') {
            return Response.json(await viewLocalAgentSkill(input.skillsDir, skillId));
        }
        if (skillId && request.method === 'DELETE') {
            return Response.json(
                await deleteLocalAgentSkill(input.skillsDir, input.agentId, skillId)
            );
        }
        return null;
    } catch (error) {
        return Response.json(
            {
                code: 'INVALID_ARG',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 409 }
        );
    }
}

function isCommittedSend(body: string): boolean {
    try {
        return z.object({ state: z.literal('sent') }).safeParse(JSON.parse(body)).success;
    } catch {
        return false;
    }
}

const preCommitFailureCodes = new Set([
    'CERT_HAS_EXPIRED',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'ConnectionRefused',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

function isDefinitelyPreCommitFailure(error: unknown): boolean {
    let current = error;
    for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
        if ('code' in current && preCommitFailureCodes.has(String(current.code))) {
            return true;
        }
        current = 'cause' in current ? current.cause : null;
    }
    return false;
}

function isAuthorized(request: Request, proxyToken: string): boolean {
    const header = request.headers.get('authorization');
    return header === `Bearer ${proxyToken}`;
}
