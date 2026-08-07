import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';

type EvalHarness = Awaited<ReturnType<typeof createEvalHarness>>;

export interface AgentChatMessage {
    author: { agentId?: string; kind: string };
    content: string;
    createdAt: string;
    sequence: number;
}

export async function pollAgentReply(
    harness: EvalHarness,
    chatId: string,
    agentId: string,
    prompt: string,
    complete: (content: string) => boolean,
    afterSequence = 0
) {
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
        const [tasks, directMessages] = await Promise.all([
            harness.trpc('task.list', {
                serverId: harness.serverId,
            }) as Promise<TaskItem[]>,
            harness.readMessages(chatId) as Promise<AgentChatMessage[]>,
        ]);
        const directReply = directMessages.find(
            (message) =>
                message.sequence > afterSequence &&
                isAgentMessage(message, agentId) &&
                complete(message.content)
        );
        if (directReply) {
            return { messages: directMessages, reply: directReply, threadChatId: undefined };
        }

        const task = tasks.find(
            (item) => item.task.chatId === chatId && item.message.content === prompt
        );
        if (task) {
            const threadMessages = (await harness.readMessages(
                task.task.threadChatId
            )) as AgentChatMessage[];
            const threadReply = threadMessages.find(
                (message) => isAgentMessage(message, agentId) && complete(message.content)
            );
            if (threadReply) {
                return {
                    messages: threadMessages,
                    reply: threadReply,
                    threadChatId: task.task.threadChatId,
                };
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for Agent ${agentId} to reply in the requested work scope.`);
}

export async function pollAgentTaskReply(harness: EvalHarness, channelId: string, agentId: string) {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
        const tasks = (await harness.trpc('task.list', {
            serverId: harness.serverId,
        })) as TaskItem[];
        const channelTasks = tasks.filter((item) => item.task.chatId === channelId);
        for (const task of channelTasks) {
            const replies = (await harness.readMessages(task.task.threadChatId)).filter(
                (message: AgentChatMessage) => isAgentMessage(message, agentId)
            );
            const reply = replies.at(-1);
            if (reply) {
                return reply;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for Agent ${agentId} to reply in a Task Thread.`);
}

export function hasAgentMessageAfter(
    messages: AgentChatMessage[],
    agentId: string,
    afterSequence: number,
    afterCreatedAt: string
) {
    return messages.some(
        (message) =>
            isAgentMessage(message, agentId) &&
            message.sequence > afterSequence &&
            message.createdAt >= afterCreatedAt
    );
}

export function isAgentMessage(message: AgentChatMessage, agentId: string) {
    return message.author.kind === 'agent' && message.author.agentId === agentId;
}

interface TaskItem {
    message: { content: string };
    task: { chatId: string; threadChatId: string };
}
