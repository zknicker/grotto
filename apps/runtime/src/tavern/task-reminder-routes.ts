import { getDb } from '../db/connection';
import { getStoredAgent } from './agents-store.ts';
import { localHumanParticipantId } from './chat-api/ids.ts';
import {
    deleteLabel,
    ensureLabels,
    getMessage,
    listLabels,
    listTasks,
    promoteMessageToTask,
    ReactionError,
    recordTaskReceipt,
    setMessageReaction,
    type TaskPriority,
    TaskRuleError,
    type TaskStatus,
    updateLabel,
    updateTaskFields,
} from './chat-api/index.ts';
import { badRequest, json, notFound, readJson } from './http';
import { publishReminderUpdated } from './reminder-events.ts';
import {
    cancelReminder,
    getReminder,
    listReminderRuns,
    listReminders,
    type ReminderRecord,
} from './reminder-store.ts';

// Operator-surface routes for the WS5 lenses: task-messages, labels,
// reactions, and the read-mostly Reminders view (cancel, don't silently
// edit — D4). The agent surface lives in agent-api-router.ts.

export async function routeTaskReminderSurfaces(
    request: Request,
    url: URL
): Promise<Response | null> {
    if (request.method === 'GET' && url.pathname === '/api/tasks') {
        const status = url.searchParams.get('status');
        return json({
            tasks: listTasks({
                chatId: url.searchParams.get('chat_id') ?? undefined,
                status: status ? (status as TaskStatus) : undefined,
            }).map((item) => ({
                chat_id: item.chatId,
                chat_kind: item.chatKind,
                chat_title: item.chatTitle,
                message: item.message,
                task: item.task,
            })),
        });
    }

    const messageTaskMatch = url.pathname.match(/^\/api\/messages\/([^/]+)\/task$/u);
    if (messageTaskMatch && request.method === 'POST') {
        const messageId = decodeURIComponent(messageTaskMatch[1]);
        const input = (await readJson(request)) as {
            assignee_id?: string | null;
            origin?: 'composed' | 'converted';
        };
        const origin = input.origin ?? 'converted';
        try {
            const task = promoteMessageToTask({
                actorId: localHumanParticipantId,
                assigneeId: input.assignee_id ?? null,
                messageId,
                origin,
            });
            const message = getMessage(messageId);
            if (message) {
                // Reserving a task for another actor at creation posts the
                // Raft assignment receipt whose @mention pierces to the
                // assignee; otherwise the receipt reflects the creation path.
                const reservedFor =
                    input.assignee_id && input.assignee_id !== localHumanParticipantId
                        ? assigneeHandle(input.assignee_id)
                        : null;
                recordTaskReceipt({
                    actorId: localHumanParticipantId,
                    chatId: message.chat_id,
                    kind: reservedFor
                        ? 'assigned'
                        : origin === 'composed'
                          ? 'created'
                          : 'converted',
                    tasks: [
                        {
                            assigneeHandle: reservedFor,
                            number: task.number,
                            title: message.content,
                        },
                    ],
                });
            }
            return json({ message: getMessage(messageId) });
        } catch (error) {
            return taskError(error);
        }
    }

    const taskPatchMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/u);
    if (taskPatchMatch && request.method === 'PATCH') {
        const messageId = decodeURIComponent(taskPatchMatch[1]);
        const input = (await readJson(request)) as {
            assignee_id?: string | null;
            label_ids?: string[];
            priority?: TaskPriority;
            status?: TaskStatus;
        };
        try {
            updateTaskFields({
                assigneeId: input.assignee_id,
                labelIds: input.label_ids,
                messageId,
                priority: input.priority,
                status: input.status,
            });
            return json({ message: getMessage(messageId) });
        } catch (error) {
            return taskError(error);
        }
    }

    const reactionMatch = url.pathname.match(/^\/api\/messages\/([^/]+)\/reactions$/u);
    if (reactionMatch && request.method === 'POST') {
        const messageId = decodeURIComponent(reactionMatch[1]);
        const input = (await readJson(request)) as { emoji: string; remove?: boolean };
        if (!input.emoji) {
            return badRequest('emoji is required.');
        }
        try {
            const message = setMessageReaction({
                actorId: localHumanParticipantId,
                emoji: input.emoji,
                messageId,
                remove: input.remove,
            });
            return json({ message });
        } catch (error) {
            if (error instanceof ReactionError) {
                return notFound();
            }
            throw error;
        }
    }

    if (url.pathname === '/api/labels' && request.method === 'GET') {
        return json({ labels: listLabels() });
    }
    if (url.pathname === '/api/labels' && request.method === 'POST') {
        const input = (await readJson(request)) as { name?: string };
        if (!input.name?.trim()) {
            return badRequest('Label name is required.');
        }
        const [id] = ensureLabels([input.name]);
        return json({ label: listLabels().find((label) => label.id === id) ?? null }, 201);
    }
    const labelMatch = url.pathname.match(/^\/api\/labels\/([^/]+)$/u);
    if (labelMatch && request.method === 'PATCH') {
        const input = (await readJson(request)) as {
            color?: Parameters<typeof updateLabel>[0]['color'];
            name?: string;
        };
        const label = updateLabel({
            color: input.color,
            labelId: decodeURIComponent(labelMatch[1]),
            name: input.name,
        });
        return label ? json({ label }) : notFound();
    }
    if (labelMatch && request.method === 'DELETE') {
        deleteLabel(decodeURIComponent(labelMatch[1]));
        return json({ ok: true });
    }

    if (request.method === 'GET' && url.pathname === '/api/reminders') {
        const statusFilter = url.searchParams.get('status');
        const statuses = statusFilter
            ? statusFilter
                  .split(',')
                  .filter(
                      (status): status is ReminderRecord['status'] =>
                          status === 'scheduled' || status === 'fired' || status === 'canceled'
                  )
            : undefined;
        return json({
            reminders: listReminders({ statuses }).map((reminder) => reminderView(reminder)),
        });
    }
    if (request.method === 'GET' && url.pathname === '/api/reminders/runs') {
        return json({
            runs: listReminderRuns({
                limit: numberParam(url, 'limit'),
                reminderId: url.searchParams.get('reminder_id') ?? undefined,
            }),
        });
    }
    const reminderCancelMatch = url.pathname.match(/^\/api\/reminders\/([^/]+)\/cancel$/u);
    if (reminderCancelMatch && request.method === 'POST') {
        const id = decodeURIComponent(reminderCancelMatch[1]);
        if (!getReminder(id)) {
            return notFound();
        }
        const reminder = cancelReminder(id);
        publishReminderUpdated();
        return json({ reminder: reminderView(reminder) });
    }

    return null;
}

function reminderView(reminder: ReminderRecord) {
    const owner = getStoredAgent(reminder.ownerAgentId, getDb());
    return {
        anchor_chat_id: reminder.anchorChatId,
        anchor_message_id: reminder.anchorMessageId,
        created_at: reminder.createdAt,
        fire_at: new Date(reminder.fireAtMs).toISOString(),
        id: reminder.id,
        owner_agent_id: reminder.ownerAgentId,
        owner_handle: owner?.name ?? null,
        repeat: reminder.repeat,
        script: reminder.script,
        status: reminder.status,
        title: reminder.title,
        updated_at: reminder.updatedAt,
    };
}

function assigneeHandle(assigneeId: string): string | null {
    return getStoredAgent(assigneeId, getDb())?.name ?? null;
}

function taskError(error: unknown): Response {
    if (error instanceof TaskRuleError) {
        return error.code === 'TASK_NOT_FOUND' || error.code === 'NOT_A_TASK'
            ? notFound()
            : badRequest(error.message);
    }
    throw error;
}

function numberParam(url: URL, name: string): number | undefined {
    const value = url.searchParams.get(name);
    if (value === null) {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
