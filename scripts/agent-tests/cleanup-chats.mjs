// Exact-set eval chat cleanup. Chats in the set expand to the task Threads
// they own. A Thread may also appear in the set on its own: scenarios track
// Threads promoted from a standing Owner DM, where the parent is deliberately
// preserved — the Thread is scenario-owned, the DM is not.

const chunkSize = 20;

export function expandEvalCleanupChatIds(chatIds, tasks) {
    const requestedChatIds = new Set([...chatIds].filter(Boolean));

    for (const entry of tasks) {
        const { chatId, threadChatId } = entry.task;
        if (requestedChatIds.has(chatId)) {
            requestedChatIds.add(threadChatId);
        }
    }

    return [...requestedChatIds];
}

export function chunkChatIds(chatIds, size = chunkSize) {
    const chunks = [];
    for (let index = 0; index < chatIds.length; index += size) {
        chunks.push(chatIds.slice(index, index + size));
    }
    return chunks;
}

/** Deletes the exact chat set, expanded to the Threads those chats own. */
export async function cleanupEvalChats({ serverId, trpc }, chatIds) {
    const requestedChatIds = [...chatIds].filter(Boolean);
    if (requestedChatIds.length === 0) {
        return [];
    }

    const tasks = await trpc('task.list', { serverId });
    const exactChatIds = new Set(expandEvalCleanupChatIds(requestedChatIds, tasks));
    for (const chatId of requestedChatIds) {
        const page = await trpc('chat.messages', { chatId, limit: 100, serverId });
        for (const thread of page.threads) {
            exactChatIds.add(thread.threadChatId);
        }
    }

    const deleted = [...exactChatIds];
    for (const chunk of chunkChatIds(deleted)) {
        await trpc('dev.cleanupEvalChats', { chatIds: chunk, serverId });
    }
    return deleted;
}
