// Shared hosted behavioral-eval plumbing. It authenticates as the configured
// development Clerk user, then drives real Server -> Computer -> model turns
// through the public hosted tRPC contract.
import { createRequire } from 'node:module';
import { appProtocolHeaders, appProtocolVersion } from '../packages/tavern-api/src/app-protocol.ts';
import { resolveDevPorts } from './dev-ports.mjs';
import { getDevEnvironmentOverrides } from './run-dev-stack.mjs';

export class InfraError extends Error {}

export async function createEvalHarness({ evalName }) {
    const serverUrl = resolveHostedServerUrl();
    const onlyFilter = resolveFlag('--only');
    const stamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/gu, '')
        .slice(0, 14);
    const results = [];
    const trackedAgentIds = new Set();
    const profileRestores = new Map();
    const configRestores = new Map();
    const auth = await createDevClerkAuth(serverUrl);

    async function trpc(path, input = {}) {
        const token = await auth.getToken();
        const response = await fetch(`${serverUrl}/trpc/${path}`, {
            body: JSON.stringify(input),
            headers: {
                ...protocolHeaders(),
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
            method: 'POST',
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(`${path} failed (${response.status}): ${formatPayload(payload)}`);
        }
        return payload?.result?.data ?? null;
    }

    const servers = await trpc('server.list');
    const server = selectHostedServer(servers, resolveFlag('--server-id'));
    const serverId = server.id;

    async function scenario(name, run, { retryOn = 'infra' } = {}) {
        if (onlyFilter && !name.includes(onlyFilter)) {
            return;
        }
        process.stdout.write(`\n▶ ${name}\n`);
        const startedAt = Date.now();
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                await run();
                results.push({ name, ok: true, seconds: seconds(startedAt) });
                process.stdout.write(`  ✓ pass (${seconds(startedAt)}s)\n`);
                return;
            } catch (error) {
                const retryable = retryOn === 'any' || error instanceof InfraError;
                if (retryable && attempt === 1) {
                    process.stdout.write(`  ↻ retrying: ${String(error).slice(0, 160)}\n`);
                    continue;
                }
                results.push({
                    error: String(error),
                    name,
                    ok: false,
                    seconds: seconds(startedAt),
                });
                process.stdout.write(`  ✗ FAIL: ${String(error).slice(0, 300)}\n`);
                return;
            }
        }
    }

    function report() {
        const failed = results.filter((result) => !result.ok);
        process.stdout.write(
            `\n${results.length - failed.length}/${results.length} scenarios passed on ${server.displayName}\n`
        );
        if (failed.length > 0) {
            process.exitCode = 1;
        }
        // Clerk's headless client keeps token-refresh timers alive after its
        // native session ends. This CLI has finished once the report is written.
        setTimeout(() => process.exit(process.exitCode ?? 0), 0);
    }

    async function requireAgents(count) {
        const agents = await trpc('agent.list', { serverId });
        const available = agents.filter(
            (agent) =>
                agent.status === 'applied' &&
                agent.availability !== 'offline' &&
                agent.availability !== 'stopped'
        );
        assert(
            available.length >= count,
            `${evalName} needs ${count} applied online Agents; found ${available.length}`
        );
        for (const agent of available.slice(0, count)) {
            trackedAgentIds.add(agent.id);
        }
        return available.slice(0, count).map((agent) => ({
            ...agent,
            name: agent.displayName,
        }));
    }

    async function requireChannel(name) {
        const chats = await trpc('chat.list', { serverId });
        const channel = chats.find((chat) => chat.kind === 'channel' && chat.name === name);
        assert(channel, `${evalName} needs the seeded #${name} channel`);
        return channel.id;
    }

    function requireDm(agent) {
        assert(agent.dmChatId, `${agent.name} has no Owner DM`);
        return agent.dmChatId;
    }

    async function withTempDescription(agent, description) {
        if (!profileRestores.has(agent.id)) {
            profileRestores.set(agent.id, {
                description: agent.description,
                displayName: agent.displayName,
            });
        }
        await trpc('agent.updateProfile', {
            agentId: agent.id,
            description,
            displayName: agent.displayName,
            serverId,
        });
    }

    async function configureAgent(agent, runtimeId, modelId) {
        if (!configRestores.has(agent.id)) {
            configRestores.set(agent.id, {
                modelId: agent.desiredModelId,
                runtimeId: agent.desiredRuntimeId,
            });
        }
        return await trpc('agent.configure', {
            agentId: agent.id,
            modelId,
            runtimeId,
            serverId,
        });
    }

    async function send(chatId, content) {
        return await trpc('chat.send', {
            attachmentIds: [],
            chatId,
            content,
            nonce: `${evalName}_${stamp}_${crypto.randomUUID()}`,
            serverId,
        });
    }

    async function readPage(chatId) {
        const [page, states] = await Promise.all([
            trpc('chat.messages', { chatId, limit: 100, serverId }),
            Promise.all(
                [...trackedAgentIds].map((agentId) =>
                    trpc('agent.deliveryState', { agentId, serverId })
                )
            ),
        ]);
        return {
            activeTurnAgentIds: states
                .filter((state) => state.running)
                .map((state) => state.agentId),
            messages: page.messages,
            threads: page.threads,
        };
    }

    async function readMessages(chatId) {
        return (await readPage(chatId)).messages;
    }

    async function readHead(chatId) {
        const messages = await readMessages(chatId);
        return messages.at(-1)?.sequence ?? 0;
    }

    function authoredBy(messages, agentId, afterSequence = 0) {
        return messages
            .filter(
                (message) =>
                    message.sequence > afterSequence &&
                    message.author.kind === 'agent' &&
                    message.author.agentId === agentId
            )
            .map((message) => message.content);
    }

    async function pollMessages(chatId, predicate, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const page = await readPage(chatId);
            if (predicate(page.messages)) {
                return page.messages;
            }
            await sleep(3000);
        }
        throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s waiting on ${chatId}`);
    }

    async function waitForTurnActive(agentId, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const state = await trpc('agent.deliveryState', { agentId, serverId });
            if (state.running) {
                return;
            }
            await sleep(1000);
        }
        throw new Error(`Agent ${agentId} never started a turn`);
    }

    async function waitForAgentQuiet(agentId, quietMs, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        let quietSince = null;
        while (Date.now() < deadline) {
            const state = await trpc('agent.deliveryState', { agentId, serverId });
            if (state.running || state.pending > 0) {
                quietSince = null;
            } else if (quietSince === null) {
                quietSince = Date.now();
            } else if (Date.now() - quietSince >= quietMs) {
                return;
            }
            await sleep(2000);
        }
        throw new Error(`Agent ${agentId} never went quiet`);
    }

    async function cleanup() {
        for (const [agentId, profile] of profileRestores) {
            await trpc('agent.updateProfile', { agentId, serverId, ...profile }).catch((error) =>
                process.stdout.write(`cleanup: profile restore failed for ${agentId}: ${error}\n`)
            );
        }
        for (const [agentId, config] of configRestores) {
            await trpc('agent.configure', { agentId, serverId, ...config }).catch((error) =>
                process.stdout.write(`cleanup: model restore failed for ${agentId}: ${error}\n`)
            );
        }
        await auth.close();
    }

    return {
        authoredBy,
        cleanup,
        configureAgent,
        pollMessages,
        readHead,
        readMessages,
        report,
        requireAgents,
        requireChannel,
        requireDm,
        scenario,
        send,
        serverId,
        stamp,
        trpc,
        waitForAgentQuiet,
        waitForTurnActive,
        withTempDescription,
    };
}

async function createDevClerkAuth(serverUrl) {
    const environment = getDevEnvironmentOverrides(process.cwd());
    const publishableKey =
        process.env.TAVERN_CLERK_PUBLISHABLE_KEY ?? environment.TAVERN_CLERK_PUBLISHABLE_KEY;
    assert(
        publishableKey,
        'Hosted eval auth needs the dev Clerk publishable key used by bun run dev'
    );

    const ticketResponse = await fetch(`${serverUrl}/trpc/dev.createClerkSignInToken`, {
        body: '{}',
        headers: { ...protocolHeaders(), 'content-type': 'application/json' },
        method: 'POST',
    });
    const ticketPayload = await ticketResponse.json().catch(() => null);
    if (!ticketResponse.ok) {
        throw new Error(
            `Dev Clerk sign-in failed (${ticketResponse.status}): ${formatPayload(ticketPayload)}`
        );
    }
    const ticket = ticketPayload?.result?.data?.ticket;
    assert(ticket, 'Dev Clerk sign-in did not return a ticket');

    const websiteRequire = createRequire(new URL('../apps/website/package.json', import.meta.url));
    const { Clerk } = websiteRequire('@clerk/clerk-js/headless');
    const clerk = new Clerk(publishableKey);
    let nativeAuthorization = '';

    clerk.__unstable__onBeforeRequest(async (requestInit) => {
        requestInit.credentials = 'omit';
        requestInit.url?.searchParams.append('_is_native', '1');
        requestInit.headers.set('authorization', nativeAuthorization);
    });
    clerk.__unstable__onAfterResponse(async (_requestInit, response) => {
        nativeAuthorization = response?.headers.get('authorization') ?? nativeAuthorization;
    });

    await clerk.load({ standardBrowser: false });
    const attempt = await clerk.client.signIn.create({ strategy: 'ticket', ticket });
    assert(attempt.status === 'complete', `Dev Clerk sign-in stopped at ${attempt.status}`);
    await clerk.setActive({ session: attempt.createdSessionId });

    return {
        close: async () => {
            await clerk.session?.end();
        },
        getToken: async () => {
            const token = await clerk.session?.getToken();
            if (!token) {
                throw new InfraError('Clerk did not provide a session token');
            }
            return token;
        },
    };
}

function protocolHeaders() {
    return {
        [appProtocolHeaders.productVersion]: 'dev-eval',
        [appProtocolHeaders.protocolVersion]: String(appProtocolVersion),
    };
}

function resolveHostedServerUrl() {
    const explicit = resolveFlag('--server');
    if (explicit) {
        return explicit.replace(/\/$/u, '');
    }
    return `http://localhost:${resolveDevPorts({ repositoryRoot: process.cwd() }).grottoPort}`;
}

function resolveFlag(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? null : (process.argv[index + 1] ?? null);
}

export function selectHostedServer(servers, requestedServerId) {
    assert(Array.isArray(servers) && servers.length > 0, 'No hosted Servers are available');
    if (requestedServerId) {
        const server = servers.find((candidate) => candidate.id === requestedServerId);
        assert(server, `No accessible Server has id ${requestedServerId}`);
        return server;
    }
    return servers.find((server) => server.slug === 'dev') ?? servers[0];
}

function formatPayload(payload) {
    return JSON.stringify(payload)?.slice(0, 400) ?? 'no response body';
}

export function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

export function seconds(startedAt) {
    return Math.round((Date.now() - startedAt) / 1000);
}

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
