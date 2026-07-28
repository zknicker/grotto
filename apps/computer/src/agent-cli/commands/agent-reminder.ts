import * as z from 'zod';
import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import { formatLocalTime } from '../agent-format.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';

// Family 8 — Reminders (D4). Author-owned wake signals anchored to a
// message; the only scheduling primitive. `--script` payloads run locally at
// fire time: empty output is a quiet tick, output rides the fire.

interface ReminderDeps {
    client: AgentApiRequester;
    write(text: string): void;
}

const reminderViewSchema = z.object({
    anchorTarget: z.string(),
    fireAt: z.string(),
    id: z.string(),
    repeat: z.string().nullable(),
    script: z.boolean(),
    status: z.string(),
    title: z.string(),
});

const reminderSingleSchema = z.object({ reminder: reminderViewSchema });
const reminderListSchema = z.object({ reminders: z.array(reminderViewSchema) });
const reminderLogSchema = z.object({
    runs: z.array(
        z.object({
            firedAt: z.string(),
            id: z.string(),
            outcome: z.string(),
            output: z.string().nullable(),
            reminderId: z.string(),
            scriptExitCode: z.number().nullable(),
        })
    ),
});

const idFlag = {
    description: 'Reminder id from grotto reminder list',
    name: '--id',
    valueName: '<id>',
};

export const REMINDER_SUBCOMMANDS: SubCommand[] = [
    {
        examples: [
            'grotto reminder schedule --title "check if CI finished" --delay-seconds 1800 --message-id 1a2b3c4d',
            'grotto reminder schedule --title "daily standup notes" --fire-at 2026-07-23T09:00:00 --repeat daily@09:00 --message-id 1a2b3c4d',
            "grotto reminder schedule --title 'watch nightly export' --delay-seconds 3600 --repeat every:1h --message-id 1a2b3c4d --script 'check-export --quiet-when-ok'",
        ],
        flags: [
            { description: 'Action-language reminder text', name: '--title', valueName: '<text>' },
            {
                description: 'Fire after N seconds from now',
                name: '--delay-seconds',
                valueName: '<n>',
            },
            { description: 'Fire at an ISO timestamp', name: '--fire-at', valueName: '<iso>' },
            {
                description:
                    'Recurring cadence: every:15m|every:2h|every:1d|daily@09:00|weekly:mon,fri@09:00',
                name: '--repeat',
                valueName: '<cadence>',
            },
            {
                description: 'Anchor message id (msg= from a message you received or read)',
                name: '--message-id',
                valueName: '<id>',
            },
            {
                description:
                    'Local script at fire time: empty output = quiet tick, output wakes you',
                name: '--script',
                valueName: '<command>',
            },
        ],
        name: 'schedule',
        positionals: [],
        run: (args) => runReminderSchedule(args, defaultDeps()),
        summary: 'Schedule an author-owned wake signal anchored to a message',
        usage: 'grotto reminder schedule --title <text> (--delay-seconds <n> | --fire-at <iso>) [--repeat <cadence>] --message-id <id> [--script <command>]',
    },
    {
        examples: ['grotto reminder list', 'grotto reminder list --status scheduled'],
        flags: [
            {
                description: 'Filter: scheduled, fired, canceled (comma-separated)',
                name: '--status',
                valueName: '<statuses>',
            },
        ],
        name: 'list',
        positionals: [],
        run: (args) => runReminderList(args, defaultDeps()),
        summary: 'List your reminders',
        usage: 'grotto reminder list [--status scheduled,fired,canceled]',
    },
    {
        examples: ['grotto reminder snooze --id rem_1a2b3c4d5e6f --by 2h'],
        flags: [
            idFlag,
            { description: 'Push later by 30m, 2h, or 1d', name: '--by', valueName: '<duration>' },
        ],
        name: 'snooze',
        positionals: [],
        run: (args) => runReminderSnooze(args, defaultDeps()),
        summary: 'Push a reminder later instead of stacking duplicates',
        usage: 'grotto reminder snooze --id <id> --by <30m|2h|1d>',
    },
    {
        examples: [
            'grotto reminder update --id rem_1a2b3c4d5e6f --title "check CI and update task #3"',
        ],
        flags: [
            idFlag,
            { description: 'New reminder text', name: '--title', valueName: '<text>' },
            { description: 'New fire time (ISO)', name: '--fire-at', valueName: '<iso>' },
            {
                description: 'New cadence, or "none" to stop repeating',
                name: '--repeat',
                valueName: '<cadence>',
            },
            {
                description: 'New script, or "none" to remove it',
                name: '--script',
                valueName: '<command>',
            },
        ],
        name: 'update',
        positionals: [],
        run: (args) => runReminderUpdate(args, defaultDeps()),
        summary: 'Change one field of a reminder',
        usage: 'grotto reminder update --id <id> (--title <text> | --fire-at <iso> | --repeat <cadence> | --script <command>)',
    },
    {
        examples: ['grotto reminder cancel --id rem_1a2b3c4d5e6f'],
        flags: [idFlag],
        name: 'cancel',
        positionals: [],
        run: (args) => runReminderCancel(args, defaultDeps()),
        summary: 'Cancel a reminder that is truly no longer needed',
        usage: 'grotto reminder cancel --id <id>',
    },
    {
        examples: ['grotto reminder log', 'grotto reminder log --id rem_1a2b3c4d5e6f --limit 20'],
        flags: [
            idFlag,
            { description: 'Max runs to show (default 50)', name: '--limit', valueName: '<n>' },
        ],
        name: 'log',
        positionals: [],
        run: (args) => runReminderLog(args, defaultDeps()),
        summary: 'Read fire history, including quiet script ticks',
        usage: 'grotto reminder log [--id <id>] [--limit <n>]',
    },
];

export async function runReminderSchedule(args: ParsedArgs, deps: ReminderDeps): Promise<number> {
    const title = args.values['--title'];
    const messageId = args.values['--message-id'];
    if (!title) {
        throw new AgentCliError('INVALID_ARG', 'Provide --title with the reminder text.');
    }
    if (!messageId) {
        throw new AgentCliError('INVALID_ARG', 'Provide --message-id with the anchor message.', {
            nextAction: 'Use the msg= id from the message this follow-up is about.',
        });
    }
    const delaySecondsRaw = args.values['--delay-seconds'];
    const delaySeconds = delaySecondsRaw === undefined ? undefined : Number(delaySecondsRaw);
    if (delaySeconds !== undefined && (!Number.isInteger(delaySeconds) || delaySeconds < 1)) {
        throw new AgentCliError('INVALID_ARG', `Invalid --delay-seconds "${delaySecondsRaw}".`);
    }
    const fireAt = args.values['--fire-at'];
    if (Boolean(delaySeconds) === Boolean(fireAt)) {
        throw new AgentCliError('INVALID_ARG', 'Pass exactly one of --delay-seconds or --fire-at.');
    }
    const response = await deps.client.request(
        '/api/agent/reminders/schedule',
        reminderSingleSchema,
        {
            body: {
                delaySeconds,
                fireAt,
                messageId,
                repeat: args.values['--repeat'],
                script: args.values['--script'],
                title,
            },
            method: 'POST',
        }
    );
    deps.write(
        `${describeReminder(response.reminder)}\nSnooze or cancel later: grotto reminder snooze --id ${response.reminder.id} --by 2h\n`
    );
    return 0;
}

export async function runReminderList(args: ParsedArgs, deps: ReminderDeps): Promise<number> {
    const status = args.values['--status'];
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await deps.client.request(`/api/agent/reminders${query}`, reminderListSchema, {
        method: 'GET',
    });
    if (response.reminders.length === 0) {
        deps.write(
            'No reminders. Schedule follow-up work with grotto reminder schedule when progress depends on future state.\n'
        );
        return 0;
    }
    deps.write(`${response.reminders.map((row) => describeReminder(row)).join('\n')}\n`);
    return 0;
}

export async function runReminderSnooze(args: ParsedArgs, deps: ReminderDeps): Promise<number> {
    const response = await deps.client.request(
        '/api/agent/reminders/snooze',
        reminderSingleSchema,
        {
            body: { by: requireFlag(args, '--by'), id: requireFlag(args, '--id') },
            method: 'POST',
        }
    );
    deps.write(`Snoozed. ${describeReminder(response.reminder)}\n`);
    return 0;
}

export async function runReminderUpdate(args: ParsedArgs, deps: ReminderDeps): Promise<number> {
    const id = requireFlag(args, '--id');
    const fields = {
        fireAt: args.values['--fire-at'],
        repeat: normalizeClearable(args.values['--repeat']),
        script: normalizeClearable(args.values['--script']),
        title: args.values['--title'],
    };
    const provided = Object.values(fields).filter((value) => value !== undefined);
    if (provided.length !== 1) {
        throw new AgentCliError(
            'INVALID_ARG',
            'Update exactly one field: --title, --fire-at, --repeat, or --script.'
        );
    }
    const response = await deps.client.request(
        '/api/agent/reminders/update',
        reminderSingleSchema,
        { body: { id, ...fields }, method: 'POST' }
    );
    deps.write(`Updated. ${describeReminder(response.reminder)}\n`);
    return 0;
}

export async function runReminderCancel(args: ParsedArgs, deps: ReminderDeps): Promise<number> {
    const response = await deps.client.request(
        '/api/agent/reminders/cancel',
        reminderSingleSchema,
        { body: { id: requireFlag(args, '--id') }, method: 'POST' }
    );
    deps.write(`Canceled reminder ${response.reminder.id} ("${response.reminder.title}").\n`);
    return 0;
}

export async function runReminderLog(args: ParsedArgs, deps: ReminderDeps): Promise<number> {
    const params = new URLSearchParams();
    const id = args.values['--id'];
    const limit = args.values['--limit'];
    if (id) {
        params.set('id', id);
    }
    if (limit) {
        params.set('limit', limit);
    }
    const query = params.size > 0 ? `?${params.toString()}` : '';
    const response = await deps.client.request(
        `/api/agent/reminders/log${query}`,
        reminderLogSchema,
        { method: 'GET' }
    );
    if (response.runs.length === 0) {
        deps.write('No reminder fires recorded yet.\n');
        return 0;
    }
    const lines = response.runs.map((run) => {
        const exit = run.scriptExitCode === null ? '' : ` exit=${run.scriptExitCode}`;
        const output = run.output ? ` — ${clip(run.output)}` : '';
        return `${formatLocalTime(run.firedAt)} ${run.reminderId} [${run.outcome}]${exit}${output}`;
    });
    deps.write(`${lines.join('\n')}\n`);
    return 0;
}

function describeReminder(reminder: z.infer<typeof reminderViewSchema>): string {
    const repeat = reminder.repeat ? ` repeats ${reminder.repeat}` : '';
    const script = reminder.script ? ' (script)' : '';
    return `${reminder.id} [${reminder.status}] "${reminder.title}" — fires ${formatLocalTime(reminder.fireAt)}${repeat}${script}, anchored in ${reminder.anchorTarget}`;
}

function normalizeClearable(value: string | undefined): string | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    return value === 'none' ? null : value;
}

function requireFlag(args: ParsedArgs, name: string): string {
    const value = args.values[name];
    if (!value) {
        throw new AgentCliError('INVALID_ARG', `Provide ${name}.`);
    }
    return value;
}

function clip(value: string): string {
    const flat = value.replaceAll(/\s+/gu, ' ').trim();
    return flat.length > 120 ? `${flat.slice(0, 119)}…` : flat;
}

function defaultDeps(): ReminderDeps {
    return {
        client: createAgentApiClient(),
        write: (text) => process.stdout.write(text),
    };
}
