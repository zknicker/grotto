// The agent-test kit: everything a scenario needs to drive real Server →
// Computer → model behavior headlessly, and nothing that requires a browser.
//
// Model: a standing Agent pool wiped on lease, turn settlement instead of
// content polling, and assertions made of structural gates plus marker
// containment.

import { createAgentAuthor } from './author.mjs';
import { cleanupEvalChats } from './cleanup-chats.mjs';
import { createAgentPool, poolProfiles } from './pool.mjs';
import { createPoolState } from './state.mjs';
import { createTurnObserver } from './turns.mjs';

const markerAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const contexts = new WeakMap();

/**
 * Builds a scenario-scoped kit over a shared harness. Pool, turn observer,
 * Agent authoring, and cross-run state are shared per harness; observed
 * messages, turns, and chats are recorded per scenario for its transcript.
 */
export function createAgentTestKit(
    harness,
    { repositoryRoot = process.cwd(), scenarioName = 'agent-test' } = {}
) {
    const context = resolveContext(harness, repositoryRoot);
    const { author, observer, pool, serverId, state, trpc } = context;
    const observedMessages = new Map();
    const observedTurns = [];
    const ownedChats = new Map();
    let leaseHandle = null;

    function record(messages) {
        for (const message of messages) {
            observedMessages.set(message.id, {
                author: message.author,
                chatId: message.chatId,
                content: message.content,
                createdAt: message.createdAt,
                id: message.id,
                sequence: message.sequence,
            });
        }
        return messages;
    }

    async function readMessages(chatId) {
        return record(await harness.readMessages(chatId));
    }

    /** Registers a chat this scenario owns, so cleanup and crash recovery find it. */
    async function trackChat(chatId, { name = null } = {}) {
        ownedChats.set(chatId, name);
        await state.remember(leaseHandle ?? 'unleased', chatId);
        return chatId;
    }

    async function createChannel({ agentIds, name } = {}) {
        const channelName = name ?? `eval-${context.stamp.slice(-6)}-${marker('').toLowerCase()}`;
        const chat = await trpc('chat.createChannel', { agentIds, name: channelName, serverId });
        await trackChat(chat.id, { name: chat.name });
        return chat;
    }

    async function sendTask(chatId, content) {
        const promotion = await trpc('task.create', {
            chatId,
            content,
            nonce: `agenttests_${context.stamp}_${crypto.randomUUID()}`,
            serverId,
        });
        const { task } = promotion;
        await trackChat(task.threadChatId);
        return {
            messageId: task.messageId,
            task,
            taskId: task.messageId,
            threadChatId: task.threadChatId,
        };
    }

    /** Thread replies target the PARENT chat plus the anchor message. */
    async function sendInThread(parentChatId, anchorMessageId, content) {
        const receipt = await trpc('chat.send', {
            chatId: parentChatId,
            content,
            nonce: `agenttests_${context.stamp}_${crypto.randomUUID()}`,
            serverId,
            thread: { anchorMessageId },
        });
        if (receipt.threadChatId) {
            await trackChat(receipt.threadChatId);
        }
        return receipt;
    }

    /**
     * An Agent may answer in the chat itself or promote the request to a task
     * whose Thread carries the reply — both satisfy an ordinary request. Polls
     * the chat plus every task Thread promoted from it.
     */
    async function awaitAgentReply(chatId, agentId, predicate, timeoutMs = 240_000) {
        const deadline = Date.now() + timeoutMs;
        const matches = (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === agentId &&
            predicate(message);
        while (Date.now() < deadline) {
            const direct = record(await harness.readMessages(chatId)).find(matches);
            if (direct) {
                return { container: 'chat', message: direct, threadChatId: null };
            }
            const tasks = await trpc('task.list', { serverId });
            for (const entry of tasks.filter((item) => item.task.chatId === chatId)) {
                await trackChat(entry.task.threadChatId);
                const inThread = record(await harness.readMessages(entry.task.threadChatId)).find(
                    matches
                );
                if (inThread) {
                    return {
                        container: 'thread',
                        message: inThread,
                        threadChatId: entry.task.threadChatId,
                    };
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        throw new Error(
            `no matching Agent reply in ${chatId} or its task Threads within ${Math.round(timeoutMs / 1000)}s.`
        );
    }

    async function readTask(messageId) {
        const tasks = await trpc('task.list', { serverId });
        const found = tasks.find((entry) => entry.task.messageId === messageId);
        if (!found) {
            throw new Error(`Task ${messageId} is no longer listed on Server ${serverId}.`);
        }
        return found.task;
    }

    async function settleTurn(agentId, options = {}) {
        const turn = await observer.settleTurn(agentId, options);
        observedTurns.push(turn);
        return {
            ...turn,
            authoredMessagesIn: async (chatId) => {
                const messages = await readMessages(chatId);
                return messages.filter(
                    (message) =>
                        message.author.kind === 'agent' &&
                        message.author.agentId === agentId &&
                        Date.parse(message.createdAt) >= Date.parse(turn.startedAt)
                );
            },
        };
    }

    async function awaitMessage(chatId, predicate, timeoutMs = 120_000) {
        const messages = record(
            await harness.pollMessages(chatId, (page) => page.some(predicate), timeoutMs)
        );
        return messages.find(predicate);
    }

    async function expectNoAgentMessages(chatId, agentId, sinceSequence = 0) {
        const messages = await readMessages(chatId);
        const authored = harness.authoredBy(messages, agentId, sinceSequence);
        if (authored.length > 0) {
            throw new Error(
                `Agent ${agentId} wrote ${authored.length} message(s) into ${chatId} after sequence ${sinceSequence}: ${authored.map((content) => JSON.stringify(content.slice(0, 120))).join(', ')}`
            );
        }
        return messages;
    }

    /** Settles the turn, then proves the Agent stayed silent in this chat. */
    async function assertSilence(agentId, chatId, { sinceSequence = 0, ...options } = {}) {
        const turn = await settleTurn(agentId, options);
        if (turn.outputProduced) {
            throw new Error(
                `Agent ${agentId} produced output in run ${turn.runId} (${turn.messageCount} message(s)) but the scenario expected silence.`
            );
        }
        await expectNoAgentMessages(chatId, agentId, sinceSequence);
        const deliveries = await observer.listDeliveries(agentId);
        const delivery = deliveries?.find((row) => row.chatId === chatId);
        if (delivery && delivery.state !== 'seen') {
            throw new Error(
                `Agent ${agentId} left delivery ${delivery.messageId} in state ${delivery.state}; silence requires a seen delivery.`
            );
        }
        return turn;
    }

    async function lease(requests) {
        const leased = await pool.lease(requests, { wipe });
        leaseHandle ??= leased.agents[0]?.handle ?? null;
        return leased;
    }

    async function wipe(agent, request) {
        const leftovers = await state.peek(agent.handle);
        if (leftovers.length > 0) {
            const deleted = await cleanupEvalChats({ serverId, trpc }, leftovers).catch((error) => {
                process.stderr.write(
                    `  ! agent-test cleanup left ${leftovers.length} chat(s) on @${agent.handle} for the next lease: ${error}\n`
                );
                return [];
            });
            if (deleted.length > 0) {
                await state.forget(deleted);
            }
        }
        await trpc('agent.reset', {
            agentId: agent.id,
            kind: request.cleanWorkspace ? 'full' : 'session',
            serverId,
        });
        await pool.waitForReady(agent.id);
    }

    async function cleanup() {
        const chatIds = [...ownedChats.keys()];
        if (chatIds.length === 0) {
            return [];
        }
        const deleted = await cleanupEvalChats({ serverId, trpc }, chatIds);
        await state.forget(deleted.length > 0 ? deleted : chatIds);
        ownedChats.clear();
        return deleted;
    }

    return {
        assertSilence,
        authorAsAgent: (agentId, target, content, options = {}) =>
            author.authorAsAgent(agentId, target, content, {
                ...options,
                chatId: options.chatId ?? [...ownedChats.keys()][0],
            }),
        authoredBy: harness.authoredBy,
        awaitAgentReply,
        awaitMessage,
        cleanup,
        createChannel,
        expectNoAgentMessages,
        harness,
        lease,
        marker,
        readHead: (chatId) => harness.readHead(chatId),
        readMessages,
        readTask,
        scenarioName,
        sendInThread,
        sendTask,
        serverId,
        settleTurn,
        stamp: context.stamp,
        trackChat,
        transcript: () => ({
            chats: [...ownedChats.entries()].map(([id, name]) => ({ id, name })),
            messages: [...observedMessages.values()].sort(byCreatedAt),
            turns: observedTurns,
        }),
        trpc,
        turns: observer,
    };
}

/** Verifies or repairs the standing pool. Safe to call repeatedly. */
export function ensureAgentTestPool(
    harness,
    { profiles = poolProfiles, repositoryRoot = process.cwd() } = {}
) {
    return resolveContext(harness, repositoryRoot).pool.ensure(profiles);
}

export function marker(prefix = 'EVAL') {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const suffix = [...bytes].map((byte) => markerAlphabet[byte % markerAlphabet.length]).join('');
    return prefix ? `${prefix}-${suffix}` : suffix;
}

function resolveContext(harness, repositoryRoot) {
    const existing = contexts.get(harness);
    if (existing) {
        return existing;
    }
    const context = {
        author: createAgentAuthor({
            repositoryRoot,
            serverId: harness.serverId,
            serverUrl: harness.serverUrl,
            stamp: harness.stamp,
        }),
        observer: createTurnObserver({ serverId: harness.serverId, trpc: harness.trpc }),
        pool: createAgentPool({ serverId: harness.serverId, trpc: harness.trpc }),
        serverId: harness.serverId,
        stamp: harness.stamp,
        state: createPoolState({ repositoryRoot }),
        trpc: harness.trpc,
    };
    contexts.set(harness, context);
    return context;
}

function byCreatedAt(left, right) {
    const delta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return delta === 0 ? left.sequence - right.sequence : delta;
}
