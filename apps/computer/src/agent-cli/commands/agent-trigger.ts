import type { SubCommand } from '../subcommand.ts';
import {
    defaultTriggerDeps,
    runTriggerCreate,
    runTriggerDelete,
    runTriggerList,
    runTriggerLog,
    runTriggerRotate,
    runTriggerShow,
    runTriggerStatus,
} from './agent-trigger-actions.ts';

export * from './agent-trigger-actions.ts';

// Family 9 — Triggers (ADR 0027). Agent-owned inbound webhooks anchored to a
// message: an outside system POSTs to a private URL and the Agent wakes. Never
// scheduled — time-based follow-up work stays with reminders.

const idFlag = {
    description: 'Trigger id from haus trigger list',
    name: '--id',
    valueName: '<id>',
};

export const TRIGGER_SUBCOMMANDS: SubCommand[] = [
    {
        examples: [
            'haus trigger create --title "deploy finished" --message-id 1a2b3c4d',
            'haus trigger create --title "sentry alert" --message-id 1a2b3c4d --instruction "Summarize the error in this thread and open a task when it is new."',
        ],
        flags: [
            {
                description: 'What the outside event means, in action language',
                name: '--title',
                valueName: '<text>',
            },
            {
                description: 'Anchor message id (msg= from the message that asked for it)',
                name: '--message-id',
                valueName: '<id>',
            },
            {
                description: 'Standing instruction replayed to you on every fire',
                name: '--instruction',
                valueName: '<text>',
            },
            {
                description: 'What kind of outside stimulus wakes you (default webhook)',
                name: '--kind',
                valueName: '<kind>',
            },
        ],
        name: 'create',
        positionals: [],
        run: (args) => runTriggerCreate(args, defaultTriggerDeps()),
        summary: 'Create an inbound webhook that wakes you when an outside system posts to it',
        usage: 'haus trigger create --title <text> --message-id <id> [--instruction <text>] [--kind <kind>]',
    },
    {
        examples: ['haus trigger list'],
        flags: [],
        name: 'list',
        positionals: [],
        run: (args) => runTriggerList(args, defaultTriggerDeps()),
        summary: 'List your triggers, their kinds, and their public URLs',
        usage: 'haus trigger list',
    },
    {
        examples: ['haus trigger show --id trg_1a2b3c4d5e6f'],
        flags: [idFlag],
        name: 'show',
        positionals: [],
        run: (args) => runTriggerShow(args, defaultTriggerDeps()),
        summary: 'Show one trigger, including its standing instruction',
        usage: 'haus trigger show --id <id>',
    },
    {
        examples: ['haus trigger disable --id trg_1a2b3c4d5e6f'],
        flags: [idFlag],
        name: 'disable',
        positionals: [],
        run: (args) => runTriggerStatus(args, defaultTriggerDeps(), 'disable'),
        summary: 'Stop a trigger from firing without deleting its history',
        usage: 'haus trigger disable --id <id>',
    },
    {
        examples: ['haus trigger enable --id trg_1a2b3c4d5e6f'],
        flags: [idFlag],
        name: 'enable',
        positionals: [],
        run: (args) => runTriggerStatus(args, defaultTriggerDeps(), 'enable'),
        summary: 'Arm a disabled trigger again',
        usage: 'haus trigger enable --id <id>',
    },
    {
        examples: ['haus trigger rotate --id trg_1a2b3c4d5e6f'],
        flags: [idFlag],
        name: 'rotate',
        positionals: [],
        run: (args) => runTriggerRotate(args, defaultTriggerDeps()),
        summary: 'Mint a new secret and invalidate the old one immediately',
        usage: 'haus trigger rotate --id <id>',
    },
    {
        examples: ['haus trigger delete --id trg_1a2b3c4d5e6f'],
        flags: [idFlag],
        name: 'delete',
        positionals: [],
        run: (args) => runTriggerDelete(args, defaultTriggerDeps()),
        summary: 'Remove a trigger while retaining its recent fire history',
        usage: 'haus trigger delete --id <id>',
    },
    {
        examples: [
            'haus trigger log --id trg_1a2b3c4d5e6f',
            'haus trigger log --id trg_1a2b3c4d5e6f --limit 10',
            'haus trigger log --id trg_1a2b3c4d5e6f --fire fir_9f8e7d6c5b4a',
        ],
        flags: [
            idFlag,
            {
                description: 'Read one fire with its full stored payload',
                name: '--fire',
                valueName: '<fireId>',
            },
            {
                description: 'Max fires to show, 1 to 100 (default 50)',
                name: '--limit',
                valueName: '<n>',
            },
        ],
        name: 'log',
        positionals: [],
        run: (args) => runTriggerLog(args, defaultTriggerDeps()),
        summary: 'Read fire history, or one fire with the payload it carried',
        usage: 'haus trigger log --id <id> [--fire <fireId>] [--limit <n>]',
    },
];
