// On-demand behavioral evals for the agent-global session model
// (specs/sessions.md, ADR 0011). Drives real model turns through a RUNNING
// dev stack (bun run dev) and checks the properties unit tests
// cannot prove end-to-end: cross-chat continuity, full serialization with
// auto-drain, mid-turn freshness, ledger-backed cross-posting, model-switch
// rotation, and the agent-scoped reset contract.
//
// Grading stays deterministic (string and outcome checks). Temp chats are
// archived afterward and the agent's model is restored. Scenario order
// matters: continuity runs before anything that resets the session.
//
// Usage: bun run eval:sessions [--server URL] [--only substring]
import { assert, createEvalHarness, sleep } from './eval-harness.mjs';

const harness = createEvalHarness({ evalName: 'sessioneval' });
const {
    authoredBy,
    cleanupChatsAndBios,
    createChat,
    createDmChat,
    mention,
    pollLog,
    readPage,
    report,
    requireAgents,
    scenario,
    send,
    stamp,
    trpc,
    waitForAllTrackedQuiet,
} = harness;

const [alpha] = await requireAgents(1);
let modelRestore = null;

try {
    await scenario('continuity: a DM fact is known in a channel without tools', async () => {
        const codename = `Kestrel-${stamp}`;
        const dm = await createDmChat(alpha, `Session eval continuity dm ${stamp}`);
        await send(dm, `The secret deploy codename is "${codename}". Confirm you noted it.`);
        await pollLog(dm, (log) => authoredBy(log, alpha.id).length > 0, 180_000);

        const channel = await createChat(`Session eval continuity ${stamp}`, [alpha.id]);
        await send(
            channel,
            `${mention(alpha)} without using any tools or memory files, what is the secret deploy codename I told you a moment ago? Answer with just the codename.`
        );
        const log = await pollLog(
            channel,
            (rows) => authoredBy(rows, alpha.id).length > 0,
            180_000
        );
        const reply = authoredBy(log, alpha.id).join(' ');
        assert(
            reply.toLowerCase().includes(codename.toLowerCase()),
            `one session should span the DM and the channel; got: ${reply.slice(0, 200)}`
        );
    });

    await scenario('serialization: a busy agent queues the second chat, answers both', async () => {
        const slowToken = `SLOW-DONE-${stamp}`;
        const quickToken = `QUICK-ACK-${stamp}`;
        const chatA = await createChat(`Session eval serial A ${stamp}`, [alpha.id]);
        const chatB = await createChat(`Session eval serial B ${stamp}`, [alpha.id]);

        await send(
            chatA,
            `${mention(alpha)} run this in your shell and only then reply with its output: sleep 20 && echo ${slowToken}`
        );
        await waitForTurnActive(chatA, 60_000);
        await send(chatB, `${mention(alpha)} reply with exactly ${quickToken}`);

        // One turn at a time: chat B must never be answered while chat A's
        // turn is still running.
        const deadline = Date.now() + 240_000;
        for (;;) {
            assert(Date.now() < deadline, 'timed out waiting for both replies');
            const [pageA, pageB] = await Promise.all([readPage(chatA), readPage(chatB)]);
            const aReplied = authoredBy(pageA.rows, alpha.id).length > 0;
            const bReplied = authoredBy(pageB.rows, alpha.id).length > 0;
            if (bReplied) {
                assert(
                    aReplied,
                    'chat B was answered while chat A was still running — turns are not serialized'
                );
                assert(
                    authoredBy(pageB.rows, alpha.id).join(' ').includes(quickToken),
                    'queued chat B turn never delivered the requested ack'
                );
                return;
            }
            await sleep(3000);
        }
    });

    // In-turn incorporation is best-effort model attention (the durable
    // guarantee is the next turn); one miss is variance, two is a break.
    await scenario(
        'freshness: a mid-turn message reaches the running turn',
        async () => {
            await waitForAllTrackedQuiet(120_000);
            const chat = await createChat(`Session eval freshness ${stamp}`, [alpha.id]);
            await send(
                chat,
                `${mention(alpha)} run 'sleep 15' in your shell. After it finishes, tell me which color I mentioned in this chat. If I never mentioned a color, reply exactly NO-COLOR.`
            );
            await waitForTurnActive(chat, 60_000);
            await sleep(2000);
            await send(chat, 'The color is vermilion.');

            // Reply rows are edited in place until the turn settles (a
            // freshness hold can revise a draft), so grade only once no
            // reply is in flight.
            const deadline = Date.now() + 240_000;
            for (;;) {
                assert(Date.now() < deadline, 'freshness turn never settled');
                const page = await readPage(chat);
                const reply = authoredBy(page.rows, alpha.id).join(' ');
                if (page.activeTurnAgentIds.length === 0 && reply.length > 0) {
                    assert(
                        reply.toLowerCase().includes('vermilion'),
                        `the settled reply never saw the mid-turn message; replies: ${reply.slice(0, 200)}`
                    );
                    return;
                }
                await sleep(3000);
            }
        },
        { retryOn: 'any' }
    );

    await scenario(
        'stale cross-post: chat_send carries the unseen message',
        async () => {
            const skyToken = `teal-${stamp}`;
            await waitForAllTrackedQuiet(120_000);
            const target = await createChat(`Session eval crosspost target ${stamp}`, [alpha.id]);
            const dm = await createDmChat(alpha, `Session eval crosspost dm ${stamp}`);

            await send(
                dm,
                `First run 'sleep 15' in your shell. Then use chat_send to post one line starting with "STATUS:" to the chat titled "Session eval crosspost target ${stamp}" (chatId: ${target}). If you have been shown any message from that chat — for example in a bracketed Grotto notice or a held-send note — include its key detail in the STATUS line. Do not use chat read tools — rely only on what you have been shown.`
            );
            await waitForTurnActive(dm, 60_000);
            await sleep(2000);
            await send(target, `Note for the record: the sky is ${skyToken} today.`);

            // The ledger must surface the unseen row to the sender — via the
            // send hold envelope or a busy-delivery notice — without tools.
            const log = await pollLog(
                target,
                (rows) => authoredBy(rows, alpha.id).some((text) => text.includes('STATUS:')),
                240_000
            );
            const status = authoredBy(log, alpha.id).find((text) => text.includes('STATUS:')) ?? '';
            assert(
                status.toLowerCase().includes(skyToken.toLowerCase()),
                `the cross-post ignored the unseen message; status post: ${status.slice(0, 200)}`
            );
        },
        { retryOn: 'any' }
    );

    await scenario('model switch: next turn runs a fresh session on the new model', async () => {
        const chat = await createChat(`Session eval model switch ${stamp}`, [alpha.id]);
        const before = await readSession(chat);
        assert(before, 'agent has no current session to switch from');

        const currentRef = `${before.effectiveModel.provider}/${before.effectiveModel.model}`;
        const models = (await trpc('model.list'))?.models ?? [];
        const targetModel = models.find((model) => model.ref !== currentRef);
        assert(
            targetModel,
            `model switch needs a second executable model; only found ${currentRef}`
        );

        modelRestore = { agentId: alpha.id, modelRef: currentRef };
        await trpc('agent.updateModel', { agentId: alpha.id, modelRef: targetModel.ref });

        await send(chat, `${mention(alpha)} reply with exactly MODEL-CHECK-${stamp}`);
        await pollLog(chat, (rows) => authoredBy(rows, alpha.id).length > 0, 240_000);

        const after = await readSession(chat);
        assert(after, 'no session after the model switch turn');
        assert(
            after.generation > before.generation,
            `model switch must start a fresh session (generation ${before.generation} -> ${after.generation})`
        );
        assert(
            `${after.effectiveModel.provider}/${after.effectiveModel.model}` === targetModel.ref,
            `fresh session runs ${after.effectiveModel.model}, expected ${targetModel.ref}`
        );
    });

    await scenario('reset: fresh generation and a durable DM notice', async () => {
        const chat = await createChat(`Session eval reset ${stamp}`, [alpha.id]);
        const before = await readSession(chat);
        assert(before, 'agent has no current session to reset');
        const dmIds = await listAgentDmChatIds(alpha.id);
        const noticesBefore = await countNewSessionNotices(dmIds);

        const result = await trpc('agent.resetSession', { agentId: alpha.id });
        assert(
            result?.session?.generation > before.generation,
            `reset must archive the session and start the next generation (${before.generation} -> ${result?.session?.generation})`
        );

        const deadline = Date.now() + 60_000;
        for (;;) {
            assert(Date.now() < deadline, 'no new-session notice appeared in any agent DM');
            if ((await countNewSessionNotices(dmIds)) > noticesBefore) {
                return;
            }
            await sleep(3000);
        }
    });
} finally {
    if (modelRestore) {
        await trpc('agent.updateModel', modelRestore).catch((error) =>
            process.stdout.write(`cleanup: model restore failed: ${error}\n`)
        );
    }
    await cleanupChatsAndBios();
}

report();

// ---------------------------------------------------------------------------

async function readSession(chatId) {
    const data = await trpc('agent.session', { agentId: alpha.id, chatId });
    return data?.session ?? null;
}

async function waitForTurnActive(chatId, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const page = await readPage(chatId);
        if (page.activeTurnAgentIds.length > 0) {
            return;
        }
        await sleep(1000);
    }
    throw new Error(`turn never started in ${chatId}`);
}

async function listAgentDmChatIds(agentId) {
    const ids = [];
    for (const path of ['chat.list', 'chat.listArchived']) {
        const data = await trpc(path).catch(() => null);
        for (const chat of Object.values(data?.itemsById ?? {})) {
            if (chat.scope === 'dm' && (chat.boundAgentIds ?? []).includes(agentId)) {
                ids.push(chat.id);
            }
        }
    }
    return ids;
}

async function countNewSessionNotices(dmChatIds) {
    let count = 0;
    for (const chatId of dmChatIds) {
        const page = await readPage(chatId);
        count += page.rows.filter(
            (row) =>
                row.kind === 'system' &&
                row.systemKind === 'runtimeNotice' &&
                row.runtimeNotice?.kind === 'new_session'
        ).length;
    }
    return count;
}
