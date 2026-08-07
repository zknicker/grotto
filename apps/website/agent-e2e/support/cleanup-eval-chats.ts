export interface EvalCleanupTask {
    task: {
        chatId: string;
        threadChatId: string;
    };
}

interface EvalCleanupChatPage {
    threads: Array<{ threadChatId: string }>;
}

interface EvalCleanupHarness {
    serverId: string;
    trpc(path: string, input: Record<string, unknown>): Promise<unknown>;
}

export type EvalCleanupOperation = <T>(operation: Promise<T>, label: string) => Promise<T>;

export function expandEvalCleanupChatIds(
    chatIds: Iterable<string | null | undefined>,
    tasks: readonly EvalCleanupTask[]
) {
    const requestedChatIds = new Set(
        [...chatIds].filter((chatId): chatId is string => Boolean(chatId))
    );

    for (const task of tasks) {
        const { chatId, threadChatId } = task.task;
        if (requestedChatIds.has(threadChatId) && !requestedChatIds.has(chatId)) {
            throw new Error(
                `Refusing Agent E2E cleanup for task Thread ${threadChatId}: its parent Chat ${chatId} is not in the exact cleanup set.`
            );
        }
        if (requestedChatIds.has(chatId)) {
            requestedChatIds.add(threadChatId);
        }
    }

    return [...requestedChatIds];
}

export async function cleanupEvalChats(
    harness: EvalCleanupHarness,
    chatIds: Iterable<string | null | undefined>,
    runOperation: EvalCleanupOperation = (operation) => operation
) {
    const requestedChatIds = [...chatIds].filter((chatId): chatId is string => Boolean(chatId));
    if (requestedChatIds.length === 0) {
        return;
    }

    const tasks = (await runOperation(
        harness.trpc('task.list', { serverId: harness.serverId }),
        `list task Threads for cleanup of ${requestedChatIds.join(', ')}`
    )) as EvalCleanupTask[];
    const exactChatIds = new Set(expandEvalCleanupChatIds(requestedChatIds, tasks));
    for (const chatId of requestedChatIds) {
        const page = (await runOperation(
            harness.trpc('chat.messages', {
                chatId,
                limit: 100,
                serverId: harness.serverId,
            }),
            `list message Threads for cleanup of ${chatId}`
        )) as EvalCleanupChatPage;
        for (const thread of page.threads) {
            exactChatIds.add(thread.threadChatId);
        }
    }
    await runOperation(
        harness.trpc('dev.cleanupEvalChats', {
            chatIds: [...exactChatIds],
            serverId: harness.serverId,
        }),
        `delete chats ${[...exactChatIds].join(', ')}`
    );
}
