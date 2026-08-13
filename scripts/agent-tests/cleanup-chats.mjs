// Exact-set eval chat cleanup. Chats in the set expand to the task Threads
// they own. A task Thread whose parent is NOT in the set is never deleted:
// deleting the thread chat alone orphans the durable task row and breaks the
// Server's task invariant for everyone (observed live as task.list 500s).
// Threads promoted from a standing Owner DM are therefore retained — the DM
// preserves them as ordinary collaboration history.

const chunkSize = 20;

export function expandEvalCleanupChatIds(chatIds, tasks) {
    const requestedChatIds = new Set([...chatIds].filter(Boolean));
    const retained = [];

    for (const entry of tasks) {
        const { chatId, threadChatId } = entry.task;
        if (requestedChatIds.has(threadChatId) && !requestedChatIds.has(chatId)) {
            requestedChatIds.delete(threadChatId);
            retained.push(threadChatId);
        }
        if (requestedChatIds.has(chatId)) {
            requestedChatIds.add(threadChatId);
        }
    }

    return { chatIds: [...requestedChatIds], retained };
}

export function chunkChatIds(chatIds, size = chunkSize) {
    const chunks = [];
    for (let index = 0; index < chatIds.length; index += size) {
        chunks.push(chatIds.slice(index, index + size));
    }
    return chunks;
}

/**
 * Deletes the exact chat set, expanded to the Threads those chats own.
 * Returns every id it RESOLVED — deleted, or intentionally retained because
 * deleting it alone would orphan a task — so callers can forget both kinds.
 */
export async function cleanupEvalChats({ serverId, trpc }, chatIds) {
    const requestedChatIds = [...chatIds].filter(Boolean);
    if (requestedChatIds.length === 0) {
        return [];
    }

    const tasks = await trpc('task.list', { serverId });
    const expansion = expandEvalCleanupChatIds(requestedChatIds, tasks);
    const exactChatIds = new Set(expansion.chatIds);
    for (const chatId of expansion.chatIds) {
        const page = await trpc('chat.messages', { chatId, limit: 100, serverId });
        for (const thread of page.threads) {
            exactChatIds.add(thread.threadChatId);
        }
    }

    for (const chunk of chunkChatIds([...exactChatIds])) {
        await trpc('dev.cleanupEvalChats', { chatIds: chunk, serverId });
    }
    if (expansion.retained.length > 0) {
        process.stderr.write(
            `  · retained ${expansion.retained.length} task Thread(s) whose parent chat is preserved (task rows must outlive the eval run)\n`
        );
    }
    return [...exactChatIds, ...expansion.retained];
}
