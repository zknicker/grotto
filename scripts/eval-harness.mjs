// Shared plumbing for on-demand behavioral evals (prompt-eval.mjs,
// session-eval.mjs). Drives real model turns through a RUNNING dev stack
// (bun run dev:web:runtime) over the server tRPC API. Grading stays
// deterministic; scenario scripts own their assertions and domain helpers.
import { resolveDevPorts } from './dev-ports.mjs';
import { createDevStackEnvironment } from './dev-stack-shared.mjs';

export class InfraError extends Error {}

export function createEvalHarness({ evalName }) {
    const serverUrl = resolveServerUrl();
    const runtimeUrl = `http://localhost:${resolveDevPorts().runtimePort}`;
    const onlyFilter = resolveOnlyFilter();
    const reuseChats = process.argv.includes('--reuse-chats');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const createdChatIds = [];
    const bioRestores = [];
    const results = [];

    // retryOn 'infra' (default) retries once on transport/provider hiccups
    // only; 'any' also retries one behavioral miss — for scenarios grading
    // best-effort model attention, where a single miss is variance and a
    // repeat is signal.
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
            `\n${results.length - failed.length}/${results.length} scenarios passed\n`
        );
        if (failed.length > 0) {
            process.exitCode = 1;
        }
    }

    async function trpc(path, body) {
        const response = await fetch(`${serverUrl}/trpc/${path}`, {
            body: JSON.stringify(body ?? {}),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(`${path} failed: ${JSON.stringify(payload)?.slice(0, 300)}`);
        }
        return payload?.result?.data ?? null;
    }

    async function requireAgents(count) {
        const data = await trpc('agent.list').catch((error) => {
            throw new Error(
                `Cannot reach the dev stack at ${serverUrl} (${error}). Start it with: bun run dev:web:runtime`
            );
        });
        const found = (data?.agents ?? []).map((agent) => ({ id: agent.id, name: agent.name }));
        assert(
            found.length >= count,
            `${evalName} needs at least ${count} agents; found ${found.length}`
        );
        return found.slice(0, count);
    }

    async function withTempBio(agent, bio) {
        // One restore entry per agent: a scenario retry (or a second temp
        // bio) must still restore the original bio, not an earlier temp one.
        if (!bioRestores.some((entry) => entry.agentId === agent.id)) {
            const data = await trpc('agent.list');
            const current = (data?.agents ?? []).find((candidate) => candidate.id === agent.id);
            bioRestores.push({ agentId: agent.id, bio: current?.bio ?? null });
        }
        await trpc('agent.updateBio', { agentId: agent.id, bio });
    }

    async function createChat(displayName, agentIds) {
        const existing = reuseChats ? await findReusableChat(displayName) : null;
        if (existing) {
            await recycleChat(existing, agentIds, displayName);
            return existing.id;
        }
        const data = await trpc('chat.create', { agentIds, displayName });
        trackChat(data.chatId);
        return data.chatId;
    }

    // Reusable chats are identified by their title with the run stamp
    // stripped, so scenario call sites keep their stamped titles untouched.
    function stripStamp(title) {
        return title.replace(/[ -]\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/u, '');
    }

    async function findReusableChat(displayName) {
        const key = stripStamp(displayName);
        for (const path of ['chat.list', 'chat.listArchived']) {
            const data = await trpc(path);
            const match = Object.values(data?.itemsById ?? {}).find(
                (chat) => stripStamp(chat.displayName) === key
            );
            if (match) {
                return match;
            }
        }
        return null;
    }

    // A recycled chat must behave like a fresh one: current stamped title
    // and membership, a fresh agent session (no context carried over from
    // the previous run), and an empty timeline. Resets are agent-global
    // (specs/sessions.md); their notice rows land in each agent's DM.
    async function recycleChat(chat, agentIds, displayName, { rename = true } = {}) {
        if (chat.archived) {
            await trpc('chat.unarchive', { chatId: chat.id });
        }
        if (rename && (chat.displayName !== displayName || !sameMembers(chat, agentIds))) {
            await trpc('chat.update', { agentIds, chatId: chat.id, displayName });
        }
        for (const agentId of new Set(agentIds)) {
            await trpc('agent.resetSession', { agentId });
        }
        await trpc('chat.clear', { chatId: chat.id });
        trackChat(chat.id);
    }

    function sameMembers(chat, agentIds) {
        const bound = chat.boundAgentIds ?? [];
        return (
            bound.length === agentIds.length &&
            new Set(bound).size === new Set([...bound, ...agentIds]).size
        );
    }

    function trackChat(chatId) {
        if (!createdChatIds.includes(chatId)) {
            createdChatIds.push(chatId);
        }
    }

    // The server API only creates channels; agents get exactly one durable
    // DM at bootstrap. Create a temp dm-kind chat straight on the runtime
    // chat API so DM scenarios never touch the agent's real DM history.
    async function createDmChat(agent, title) {
        // DM titles are never referenced in scenario prompts, and dm-kind
        // chats are runtime-created, so recycling skips the server rename.
        const existing = reuseChats ? await findReusableChat(title) : null;
        if (existing) {
            await recycleChat(existing, [agent.id], title, { rename: false });
            return existing.id;
        }
        const token = resolveRuntimeToken();
        assert(token, 'no runtime API token found (TAVERN_RUNTIME_TOKEN or grotto.json)');
        const chatId = `cht_${evalName}_${Date.now()}_dm`;
        const response = await fetch(`${runtimeUrl}/api/chats`, {
            body: JSON.stringify({
                id: chatId,
                kind: 'dm',
                metadata: {
                    runtime: { source: 'tavern' },
                    tavern: {
                        agentIds: [agent.id],
                        archived: false,
                        displayName: title,
                        displayNameSource: 'explicit',
                        tabAppearance: { color: null },
                    },
                },
                participants: [
                    {
                        id: 'usr_tavern',
                        kind: 'user',
                        label: 'You',
                        metadata: { source: 'tavern' },
                    },
                    {
                        id: agent.id,
                        kind: 'agent',
                        label: agent.name,
                        metadata: { agentId: agent.id, source: 'tavern' },
                    },
                ],
                title,
            }),
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            method: 'POST',
        });
        assert(response.ok, `runtime dm chat create failed: ${response.status}`);
        trackChat(chatId);
        return chatId;
    }

    function mention(agent) {
        return `[${agent.name}](agent://${agent.id})`;
    }

    async function send(chatId, content) {
        return await trpc('chat.send', { chatId, content });
    }

    // In-flight turns ride the chat record (I1: turns float on the session;
    // chat.log.list carries durable rows only), so quiet-detection reads the
    // chat's activeTurnParticipantIds alongside the timeline page.
    async function readPage(chatId) {
        const [page, chat] = await Promise.all([
            trpc('chat.log.list', { id: chatId, limit: 100 }),
            trpc('chat.get', { chatId }),
        ]);
        const record = chat?.chat ?? chat;
        return {
            activeTurnAgentIds: record?.activeTurnParticipantIds ?? [],
            rows: page?.rows ?? [],
        };
    }

    async function readLog(chatId) {
        return (await readPage(chatId)).rows;
    }

    function authoredBy(log, agentId) {
        return log
            .filter(
                (row) =>
                    row.kind === 'message' &&
                    row.message?.senderType === 'agent' &&
                    row.message?.tavernAgentId === agentId
            )
            .map((row) => row.message?.content ?? '');
    }

    // D8 (specs/tasks.md): a work request may be claimed as a task and worked
    // in its thread — the thread is the work surface. Thread replies never
    // surface as parent-channel rows; the anchor row carries the thread
    // pointer, and threads are chats, so the same timeline read serves them.
    async function authoredInThreads(log, agentId) {
        const replies = [];
        for (const row of log) {
            if (!row.thread?.threadChatId) {
                continue;
            }
            replies.push(...authoredBy(await readLog(row.thread.threadChatId), agentId));
        }
        return replies;
    }

    async function pollLog(chatId, predicate, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const page = await readPage(chatId);
            if (predicate(page.rows)) {
                return page.rows;
            }
            await sleep(3000);
        }
        throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s waiting on ${chatId}`);
    }

    async function pollUntilSilent(chatId, agentId, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        const startedAt = Date.now();
        let sawActiveTurn = false;
        while (Date.now() < deadline) {
            const page = await readPage(chatId);
            const replies = authoredBy(page.rows, agentId);
            if (replies.length > 0) {
                throw new Error(`expected no reply, got: ${replies[0]?.slice(0, 120)}`);
            }
            if (page.activeTurnAgentIds.length > 0) {
                sawActiveTurn = true;
            } else if (sawActiveTurn || Date.now() - startedAt > 60_000) {
                return;
            }
            await sleep(3000);
        }
        throw new Error('turn never settled');
    }

    // Quiet means no timeline rows AND no in-flight turns changing: an agent
    // thinking silently must hold the window open until its turn settles, or
    // a slow turn could be graded before its reply lands.
    async function waitForQuiet(chatId, quietMs, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        let lastSignature = null;
        let quietSince = Date.now();
        while (Date.now() < deadline) {
            const page = await readPage(chatId);
            const signature = JSON.stringify({ active: page.activeTurnAgentIds, rows: page.rows });
            if (signature !== lastSignature) {
                lastSignature = signature;
                quietSince = Date.now();
            } else if (page.activeTurnAgentIds.length === 0 && Date.now() - quietSince >= quietMs) {
                return;
            }
            await sleep(5000);
        }
        throw new Error('chat never went quiet');
    }

    // Wait until no tracked chat has an in-flight reply — scenarios that
    // depend on WHICH turn is running must not start while a previous
    // scenario's (or attempt's) turn still runs somewhere.
    async function waitForAllTrackedQuiet(timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const pages = await Promise.all(createdChatIds.map((chatId) => readPage(chatId)));
            if (pages.every((page) => page.activeTurnAgentIds.length === 0)) {
                return;
            }
            await sleep(2000);
        }
        throw new Error('tracked chats never went quiet');
    }

    async function cleanupChatsAndBios() {
        for (const restore of bioRestores) {
            await trpc('agent.updateBio', restore).catch((error) =>
                process.stdout.write(
                    `cleanup: bio restore failed for ${restore.agentId}: ${error}\n`
                )
            );
        }
        for (const chatId of createdChatIds) {
            if (reuseChats) {
                await trpc('chat.clear', { chatId }).catch((error) =>
                    process.stdout.write(`cleanup: clear failed for ${chatId}: ${error}\n`)
                );
            }
            await trpc('chat.archive', { chatId }).catch((error) =>
                process.stdout.write(`cleanup: archive failed for ${chatId}: ${error}\n`)
            );
        }
        if (createdChatIds.length > 0) {
            process.stdout.write(
                reuseChats
                    ? `\ncleared and archived reusable eval chats: ${createdChatIds.join(', ')}\n`
                    : `\narchived temp chats: ${createdChatIds.join(', ')}\n`
            );
        }
    }

    return {
        authoredBy,
        authoredInThreads,
        cleanupChatsAndBios,
        createChat,
        createDmChat,
        mention,
        pollLog,
        pollUntilSilent,
        readLog,
        readPage,
        report,
        requireAgents,
        reuseChats,
        scenario,
        send,
        serverUrl,
        stamp,
        trackChat,
        trpc,
        waitForAllTrackedQuiet,
        waitForQuiet,
        withTempBio,
    };
}

function resolveServerUrl() {
    const flagIndex = process.argv.indexOf('--server');
    if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
        return process.argv[flagIndex + 1].replace(/\/$/, '');
    }
    const { serverPort } = resolveDevPorts();
    return `http://localhost:${serverPort}`;
}

function resolveOnlyFilter() {
    const flagIndex = process.argv.indexOf('--only');
    return flagIndex !== -1 ? (process.argv[flagIndex + 1] ?? null) : null;
}

// The runtime API requires its bearer token for direct dm-chat creation.
// The dev stack resolves a per-worktree runtime root and token file; reuse
// that resolution so the eval and the running stack always agree.
function resolveRuntimeToken() {
    return createDevStackEnvironment().TAVERN_RUNTIME_TOKEN ?? null;
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
