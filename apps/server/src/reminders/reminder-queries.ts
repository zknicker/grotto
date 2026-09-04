import { and, asc, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    reminderAgentAttentionTable,
    reminderFiresTable,
    remindersTable,
} from '../postgres/schema.ts';
import { requireActiveAgent, requireAgentAnchor } from './reminder-model.ts';

export interface ReminderFire {
    firedAt: string;
    id: string;
    reminderId: string;
    scheduledFor: string;
    scriptExitCode?: number | null;
    scriptOutput?: string | null;
    scriptTimedOut?: boolean;
}

export interface ReminderAgentAttention {
    agentId: string;
    anchorChatId: string;
    fireId: string;
    id: string;
    kind: 'reminder' | 'reminder_script';
    queuedAt: string;
    reminderId: string;
    script: string | null;
}

export async function listReminderFires(
    db: GrottoDatabase,
    input: {
        actor: { agentId: string; kind: 'agent' };
        reminderId: string;
        serverId: string;
    }
): Promise<ReminderFire[]> {
    await requireOwnedReminder(db, input.serverId, input.actor.agentId, input.reminderId);
    const rows = await db
        .select()
        .from(reminderFiresTable)
        .where(
            and(
                eq(reminderFiresTable.serverId, input.serverId),
                eq(reminderFiresTable.reminderId, input.reminderId)
            )
        )
        .orderBy(asc(reminderFiresTable.scheduledFor), asc(reminderFiresTable.id));
    return rows.map((row) => ({
        firedAt: row.firedAt.toISOString(),
        id: row.id,
        reminderId: row.reminderId,
        scheduledFor: row.scheduledFor.toISOString(),
        scriptExitCode: row.scriptExitCode,
        scriptOutput: row.scriptOutput,
        scriptTimedOut: row.scriptTimedOut,
    }));
}

export async function listReminderAgentAttention(
    db: GrottoDatabase,
    input: { agentId: string; serverId: string }
): Promise<ReminderAgentAttention[]> {
    await requireActiveAgent(db, input.serverId, input.agentId);
    const rows = await db
        .select()
        .from(reminderAgentAttentionTable)
        .where(
            and(
                eq(reminderAgentAttentionTable.serverId, input.serverId),
                eq(reminderAgentAttentionTable.agentId, input.agentId)
            )
        )
        .orderBy(asc(reminderAgentAttentionTable.queuedAt), asc(reminderAgentAttentionTable.id));
    return rows.map((row) => ({
        agentId: row.agentId,
        anchorChatId: row.anchorChatId,
        fireId: row.fireId,
        id: row.id,
        kind: row.kind,
        queuedAt: row.queuedAt.toISOString(),
        reminderId: row.reminderId,
        script: row.script,
    }));
}

async function requireOwnedReminder(
    db: GrottoDatabase,
    serverId: string,
    agentId: string,
    reminderId: string
) {
    await requireActiveAgent(db, serverId, agentId);
    const [reminder] = await db
        .select({
            anchorChatId: remindersTable.anchorChatId,
            anchorMessageId: remindersTable.anchorMessageId,
        })
        .from(remindersTable)
        .where(
            and(
                eq(remindersTable.serverId, serverId),
                eq(remindersTable.id, reminderId),
                eq(remindersTable.ownerAgentId, agentId)
            )
        )
        .limit(1);
    if (!reminder) {
        throw new Error('The reminder is not owned by this Agent.');
    }
    await requireAgentAnchor(db, {
        agentId,
        anchorChatId: reminder.anchorChatId,
        anchorMessageId: reminder.anchorMessageId,
        serverId,
    });
}
