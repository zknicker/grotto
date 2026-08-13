// Crash recovery. A run that died mid-scenario left its Agents and chats on
// the Server; the next run deletes exactly the ids that run recorded, and
// forgets only what a delete confirmed. Nothing is matched by name or age, so
// an unrelated Agent or chat can never be swept.

import { cleanupEvalChats } from './cleanup-chats.mjs';
import { retireAgents } from './provisioner.mjs';
import { createRunLedger } from './state.mjs';

export async function sweepAgentTestLeftovers(harness, { repositoryRoot = process.cwd() } = {}) {
    const ledger = createRunLedger({ repositoryRoot, stamp: harness.stamp });
    const leftovers = await ledger.leftovers();
    const swept = { agents: 0, chats: 0, failures: [], runs: [] };

    for (const run of leftovers) {
        const chats = await sweepChats(harness, run.chatIds, swept);
        const { failures, retired } = await retireAgents(harness, run.agents);
        swept.failures.push(...failures.map((failure) => failure.error));
        swept.agents += retired.length;
        swept.chats += chats.length;
        if (chats.length > 0) {
            await ledger.forgetChats(chats);
        }
        if (retired.length > 0) {
            await ledger.forgetAgents(retired);
        }
        if (chats.length > 0 || retired.length > 0) {
            swept.runs.push(run.stamp);
        }
    }
    return swept;
}

export function describeSweep(swept) {
    if (swept.agents === 0 && swept.chats === 0 && swept.failures.length === 0) {
        return null;
    }
    const failed = swept.failures.length > 0 ? `, ${swept.failures.length} deferred` : '';
    return `swept ${swept.agents} Agent(s) and ${swept.chats} chat(s) left by ${swept.runs.length} earlier run(s)${failed}`;
}

async function sweepChats(harness, chatIds, swept) {
    if (chatIds.length === 0) {
        return [];
    }
    try {
        return await cleanupEvalChats({ serverId: harness.serverId, trpc: harness.trpc }, chatIds);
    } catch (error) {
        swept.failures.push(String(error));
        return [];
    }
}
