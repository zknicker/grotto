import * as z from 'zod';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import { AgentApiError } from './agent-api-errors.ts';
import { formatAgentTarget } from './agent-targets.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createMessageId } from './chat-api/ids.ts';
import {
    AmbiguousMessageIdError,
    createMessage,
    getChat,
    resolveMessageId,
} from './chat-api/index.ts';
import { nextFireAtMs, parseCadence, parseSnoozeDuration } from './reminder-cadence.ts';
import { publishReminderUpdated } from './reminder-events.ts';
import { reminderScheduleReceipt } from './reminder-scheduler.ts';
import {
    cancelReminder,
    createReminder,
    getReminder,
    listReminderRuns,
    listReminders,
    type ReminderRecord,
    rescheduleReminder,
    updateReminder,
} from './reminder-store.ts';

// Agent surface for D4 reminders: schedule / list / snooze / update / cancel
// / log. Author-owned: every verb operates only on the caller's reminders.

export const agentReminderScheduleRequestSchema = z
    .object({
        delaySeconds: z.number().int().positive().optional(),
        fireAt: z.string().min(1).optional(),
        messageId: z.string().min(1),
        repeat: z.string().min(1).optional(),
        script: z.string().min(1).optional(),
        title: z.string().min(1).max(300),
    })
    .refine((input) => Boolean(input.delaySeconds) !== Boolean(input.fireAt), {
        message: 'Pass exactly one of delaySeconds or fireAt.',
    });

export const agentReminderSnoozeRequestSchema = z.object({
    by: z.string().min(1),
    id: z.string().min(1),
});

export const agentReminderUpdateRequestSchema = z
    .object({
        fireAt: z.string().min(1).optional(),
        id: z.string().min(1),
        repeat: z.string().min(1).nullable().optional(),
        script: z.string().min(1).nullable().optional(),
        title: z.string().min(1).max(300).optional(),
    })
    .refine(
        (input) =>
            [input.fireAt, input.repeat, input.script, input.title].filter(
                (field) => field !== undefined
            ).length === 1,
        { message: 'Update exactly one field per call.' }
    );

export const agentReminderCancelRequestSchema = z.object({ id: z.string().min(1) });

export interface AgentReminderView {
    anchorTarget: string;
    fireAt: string;
    id: string;
    repeat: string | null;
    script: boolean;
    status: string;
    title: string;
}

export function scheduleAgentReminder(
    agentId: string,
    input: z.infer<typeof agentReminderScheduleRequestSchema>,
    db: Database = getDb()
): { reminder: AgentReminderView } {
    const agent = getStoredAgent(agentId, db);
    if (!agent) {
        throw new AgentApiError('TARGET_NOT_FOUND', 'Calling agent was not found.', 404);
    }
    if (input.repeat && !parseCadence(input.repeat)) {
        throw new AgentApiError(
            'INVALID_ARG',
            `Invalid repeat cadence "${input.repeat}".`,
            400,
            'Use every:15m, every:2h, every:1d, daily@09:00, or weekly:mon,fri@09:00.'
        );
    }
    const anchor = resolveAnchor(input.messageId, db);
    assertAnchorMembership(agentId, anchor.chat_id, db);
    const fireAtMs = input.delaySeconds
        ? Date.now() + input.delaySeconds * 1000
        : parseFireAt(input.fireAt ?? '');
    const reminder = createReminder(
        {
            anchorChatId: anchor.chat_id,
            anchorMessageId: anchor.id,
            fireAtMs,
            ownerAgentId: agentId,
            repeat: input.repeat ?? null,
            script: input.script ?? null,
            title: input.title,
        },
        db
    );
    // Receipt in the anchored surface: observable scheduling (D4). Marked so
    // delivery skips agents — humans see it, nobody wakes for it.
    createMessage(
        anchor.chat_id,
        {
            author_id: 'sys_reminder',
            content: reminderScheduleReceipt(reminder, agent.name),
            id: createMessageId(),
            metadata: {
                runtime: {
                    reminderId: reminder.id,
                    reminderOwnerAgentId: agentId,
                    source: 'reminder-receipt',
                },
            },
            role: 'system',
        },
        db
    );
    publishReminderUpdated();
    return { reminder: toView(reminder, agentId, db) };
}

export function listAgentReminders(
    agentId: string,
    input: { statuses?: string },
    db: Database = getDb()
): { reminders: AgentReminderView[] } {
    const statuses = input.statuses
        ?.split(',')
        .map((status) => status.trim())
        .filter(
            (status): status is 'scheduled' | 'fired' | 'canceled' =>
                status === 'scheduled' || status === 'fired' || status === 'canceled'
        );
    const reminders = listReminders({ ownerAgentId: agentId, statuses }, db);
    return { reminders: reminders.map((reminder) => toView(reminder, agentId, db)) };
}

export function snoozeAgentReminder(
    agentId: string,
    input: z.infer<typeof agentReminderSnoozeRequestSchema>,
    db: Database = getDb()
): { reminder: AgentReminderView } {
    const reminder = requireOwnReminder(agentId, input.id, db);
    const byMs = parseSnoozeDuration(input.by);
    if (!byMs) {
        throw new AgentApiError(
            'INVALID_ARG',
            `Invalid snooze duration "${input.by}".`,
            400,
            'Use forms like 30m, 2h, or 1d.'
        );
    }
    const updated = rescheduleReminder(reminder.id, Date.now() + byMs, db);
    publishReminderUpdated();
    return { reminder: toView(updated, agentId, db) };
}

export function updateAgentReminder(
    agentId: string,
    input: z.infer<typeof agentReminderUpdateRequestSchema>,
    db: Database = getDb()
): { reminder: AgentReminderView } {
    const reminder = requireOwnReminder(agentId, input.id, db);
    if (input.repeat && !parseCadence(input.repeat)) {
        throw new AgentApiError('INVALID_ARG', `Invalid repeat cadence "${input.repeat}".`, 400);
    }
    const updated = updateReminder(
        reminder.id,
        {
            ...(input.fireAt === undefined ? {} : { fireAtMs: parseFireAt(input.fireAt) }),
            ...(input.repeat === undefined ? {} : { repeat: input.repeat }),
            ...(input.script === undefined ? {} : { script: input.script }),
            ...(input.title === undefined ? {} : { title: input.title }),
        },
        db
    );
    publishReminderUpdated();
    return { reminder: toView(updated, agentId, db) };
}

export function cancelAgentReminder(
    agentId: string,
    input: z.infer<typeof agentReminderCancelRequestSchema>,
    db: Database = getDb()
): { reminder: AgentReminderView } {
    const reminder = requireOwnReminder(agentId, input.id, db);
    const canceled = cancelReminder(reminder.id, db);
    publishReminderUpdated();
    return { reminder: toView(canceled, agentId, db) };
}

export function readAgentReminderLog(
    agentId: string,
    input: { id?: string; limit?: number },
    db: Database = getDb()
): {
    runs: Array<{
        firedAt: string;
        id: string;
        outcome: string;
        output: string | null;
        reminderId: string;
        scriptExitCode: number | null;
    }>;
} {
    if (input.id) {
        requireOwnReminder(agentId, input.id, db);
    }
    const runs = listReminderRuns(
        { limit: input.limit, ownerAgentId: agentId, reminderId: input.id },
        db
    );
    return {
        runs: runs.map((run) => ({
            firedAt: run.firedAt,
            id: run.id,
            outcome: run.outcome,
            output: run.output,
            reminderId: run.reminderId,
            scriptExitCode: run.scriptExitCode,
        })),
    };
}

/** Next fire preview for update confirmations; exported for the scheduler test. */
export function previewNextFire(repeat: string, afterMs: number): number | null {
    const cadence = parseCadence(repeat);
    return cadence ? nextFireAtMs(cadence, afterMs, resolveHomeTimezone()) : null;
}

function requireOwnReminder(agentId: string, id: string, db: Database): ReminderRecord {
    const reminder = getReminder(id, db);
    if (!reminder || reminder.ownerAgentId !== agentId) {
        throw new AgentApiError(
            'REMINDER_NOT_FOUND',
            `No reminder "${id}" owned by the caller.`,
            404,
            'grotto reminder list'
        );
    }
    return reminder;
}

function resolveAnchor(messageId: string, db: Database) {
    let anchor: ReturnType<typeof resolveMessageId>;
    try {
        anchor = resolveMessageId(messageId, {}, db);
    } catch (error) {
        if (error instanceof AmbiguousMessageIdError) {
            throw new AgentApiError('AMBIGUOUS_ID', error.message, 409, 'Use the full message id.');
        }
        throw error;
    }
    if (!anchor) {
        throw new AgentApiError(
            'TARGET_NOT_FOUND',
            `No message "${messageId}" found to anchor the reminder.`,
            404,
            'Pass the msg= id of a message you received or read.'
        );
    }
    return anchor;
}

function assertAnchorMembership(agentId: string, chatId: string, db: Database): void {
    const chat = getChat(chatId, db);
    if (!chat) {
        throw new AgentApiError('TARGET_NOT_FOUND', 'Anchor chat was not found.', 404);
    }
    const membership =
        chat.kind === 'thread' && chat.parent_chat_id ? getChat(chat.parent_chat_id, db) : chat;
    const participantId = createAgentParticipantId(agentId);
    const isMember = membership?.participants.some(
        (participant) =>
            participant.id === participantId || participant.metadata.agentId === agentId
    );
    if (!isMember) {
        throw new AgentApiError(
            'NOT_A_MEMBER',
            'Reminders anchor only to surfaces you belong to.',
            403
        );
    }
}

function parseFireAt(value: string): number {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
        throw new AgentApiError('INVALID_ARG', `Invalid fireAt timestamp "${value}".`, 400);
    }
    if (parsed <= Date.now()) {
        throw new AgentApiError('INVALID_ARG', 'fireAt must be in the future.', 400);
    }
    return parsed;
}

function toView(reminder: ReminderRecord, agentId: string, db: Database): AgentReminderView {
    return {
        anchorTarget: anchorTargetText(reminder, agentId, db),
        fireAt: new Date(reminder.fireAtMs).toISOString(),
        id: reminder.id,
        repeat: reminder.repeat,
        script: Boolean(reminder.script),
        status: reminder.status,
        title: reminder.title,
    };
}

function anchorTargetText(reminder: ReminderRecord, agentId: string, db: Database): string {
    const chat = getChat(reminder.anchorChatId, db);
    if (!chat) {
        return reminder.anchorMessageId;
    }
    return formatAgentTarget(agentId, chat, db) ?? reminder.anchorMessageId;
}
