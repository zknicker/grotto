import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    cancelHostedReminder,
    listHostedReminderFires,
    listHostedReminders,
    scheduleHostedReminder,
    snoozeHostedReminder,
    updateHostedReminder,
} from '../reminders/hosted-reminders.ts';
import type { HostedReminder } from '../reminders/reminder-model.ts';
import { resolveAgentMessage } from './message-read.ts';
import { targetForChat } from './message-view.ts';

const clock = { now: () => new Date() };

export async function scheduleAgentReminder(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: {
        commandId: string;
        fireAt: string;
        messageId: string;
        repeat?: string;
        script?: string;
        title: string;
    }
) {
    const anchor = await resolveAgentMessage(db, runner, input.messageId);
    const fireAt = new Date(input.fireAt);
    const result = await scheduleHostedReminder(
        db,
        runner.agentId,
        {
            anchorChatId: anchor.chat_id,
            anchorMessageId: anchor.id,
            commandId: input.commandId,
            fireAt,
            repeat: input.repeat,
            script: input.script,
            serverId: runner.serverId,
            title: input.title,
        },
        clock
    );
    return { reminder: await toCliReminder(db, runner.serverId, result.reminder) };
}

export async function listAgentReminders(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    statuses?: string[]
) {
    const reminders = await listHostedReminders(db, {
        actor: { agentId: runner.agentId, kind: 'agent' },
        serverId: runner.serverId,
    });
    const filtered = statuses?.length
        ? reminders.filter((reminder) => statuses.includes(reminder.status))
        : reminders;
    return {
        reminders: await Promise.all(
            filtered.map((reminder) => toCliReminder(db, runner.serverId, reminder))
        ),
    };
}

export async function snoozeAgentReminder(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: { by: string; commandId: string; expectedVersion: number; id: string }
) {
    await ownedReminder(db, runner, input.id);
    const result = await snoozeHostedReminder(
        db,
        runner.agentId,
        commandInput(runner, input, { duration: input.by }),
        clock
    );
    return { reminder: await toCliReminder(db, runner.serverId, result.reminder) };
}

export async function updateAgentReminder(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: {
        fireAt?: string;
        commandId: string;
        expectedVersion: number;
        id: string;
        repeat?: string | null;
        script?: string | null;
        title?: string;
    }
) {
    await ownedReminder(db, runner, input.id);
    const result = await updateHostedReminder(
        db,
        runner.agentId,
        commandInput(runner, input, {
            ...(input.fireAt ? { fireAt: new Date(input.fireAt) } : {}),
            ...('repeat' in input ? { repeat: input.repeat } : {}),
            ...('script' in input ? { script: input.script } : {}),
            ...(input.title ? { title: input.title } : {}),
        }),
        clock
    );
    return { reminder: await toCliReminder(db, runner.serverId, result.reminder) };
}

export async function cancelAgentReminder(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: { commandId: string; expectedVersion: number; id: string }
) {
    await ownedReminder(db, runner, input.id);
    const result = await cancelHostedReminder(
        db,
        runner.agentId,
        commandInput(runner, input, {}),
        clock
    );
    return { reminder: await toCliReminder(db, runner.serverId, result.reminder) };
}

export async function readAgentReminderLog(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: { id?: string; limit: number }
) {
    const reminders = input.id
        ? [await ownedReminder(db, runner, input.id)]
        : await listHostedReminders(db, {
              actor: { agentId: runner.agentId, kind: 'agent' },
              serverId: runner.serverId,
          });
    const fires = (
        await Promise.all(
            reminders.map((reminder) =>
                listHostedReminderFires(db, {
                    actor: { agentId: runner.agentId, kind: 'agent' },
                    reminderId: reminder.id,
                    serverId: runner.serverId,
                })
            )
        )
    )
        .flat()
        .sort((left, right) => right.firedAt.localeCompare(left.firedAt))
        .slice(0, input.limit);
    return {
        runs: fires.map((fire) => ({
            firedAt: fire.firedAt,
            id: fire.id,
            outcome: fire.scriptTimedOut
                ? 'timed_out'
                : fire.scriptExitCode && fire.scriptExitCode !== 0
                  ? 'failed'
                  : 'fired',
            output: fire.scriptOutput ?? null,
            reminderId: fire.reminderId,
            scriptExitCode: fire.scriptExitCode ?? null,
        })),
    };
}

async function ownedReminder(db: GrottoDatabase, runner: ResolvedRunner, id: string) {
    const reminders = await listHostedReminders(db, {
        actor: { agentId: runner.agentId, kind: 'agent' },
        serverId: runner.serverId,
    });
    const reminder = reminders.find((candidate) => candidate.id === id);
    if (!reminder) {
        throw new Error('The reminder is not owned by this Agent.');
    }
    return reminder;
}

function commandInput<Extra extends object>(
    runner: ResolvedRunner,
    input: { commandId: string; expectedVersion: number; id: string },
    extra: Extra
) {
    return {
        commandId: input.commandId,
        expectedVersion: input.expectedVersion,
        reminderId: input.id,
        serverId: runner.serverId,
        ...extra,
    };
}

async function toCliReminder(db: GrottoDatabase, serverId: string, reminder: HostedReminder) {
    return {
        anchorTarget: await targetForChat(db, serverId, reminder.anchorChatId),
        fireAt: reminder.fireAt,
        id: reminder.id,
        repeat: reminder.repeat,
        script: reminder.hasScript,
        status: reminder.status,
        title: reminder.title,
        version: reminder.version,
    };
}
