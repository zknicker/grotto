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
    let observedWork = false;
    let quietSince: number | undefined;
    while (Date.now() < deadline) {
        const [tasks, directMessages, deliveryState, activity] = await Promise.all([
            harness.trpc('task.list', {
                serverId: harness.serverId,
            }) as Promise<TaskItem[]>,
            harness.readMessages(chatId) as Promise<AgentChatMessage[]>,
            harness.trpc('agent.deliveryState', {
                agentId,
                serverId: harness.serverId,
            }) as Promise<AgentDeliveryState>,
            harness.trpc('agent.activity', {
                agentId,
                limit: 5,
                serverId: harness.serverId,
            }) as Promise<AgentActivityEntry[]>,
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
        let threadMessages: AgentChatMessage[] = [];
        if (task) {
            threadMessages = (await harness.readMessages(
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

        const hasAgentOutput =
            directMessages.some(
                (message) => message.sequence > afterSequence && isAgentMessage(message, agentId)
            ) || threadMessages.some((message) => isAgentMessage(message, agentId));
        const promptMessage = directMessages.find((message) => message.content === prompt);
        const settledTurn = promptMessage
            ? activity.find((entry) => entry.startedAt >= promptMessage.createdAt)
            : undefined;
        observedWork ||= deliveryState.running || deliveryState.pending > 0 || hasAgentOutput;
        if (settledTurn) {
            throw new Error(
                `Agent ${agentId} settled without a matching reply. Turn: ${settledTurn.status}, ${JSON.stringify(settledTurn.summary)}. Parent replies: ${formatReplies(directMessages, agentId, afterSequence)}. Task replies: ${formatReplies(threadMessages, agentId)}.`
            );
        }
        if (observedWork && !(deliveryState.running || deliveryState.pending > 0)) {
            quietSince ??= Date.now();
            if (Date.now() - quietSince >= 2000) {
                throw new Error(
                    `Agent ${agentId} settled without a matching reply. Parent replies: ${formatReplies(directMessages, agentId, afterSequence)}. Task replies: ${formatReplies(threadMessages, agentId)}.`
                );
            }
        } else {
            quietSince = undefined;
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

interface AgentDeliveryState {
    pending: number;
    running: boolean;
}

interface AgentActivityEntry {
    startedAt: string;
    status: 'completed' | 'failed';
    summary: string;
}

function formatReplies(messages: AgentChatMessage[], agentId: string, afterSequence = 0) {
    const replies = messages
        .filter((message) => message.sequence > afterSequence && isAgentMessage(message, agentId))
        .map((message) => JSON.stringify(message.content));
    return replies.length > 0 ? replies.join(', ') : 'none';
}
