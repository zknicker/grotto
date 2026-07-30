import type { SubCommand } from '../subcommand.ts';
import {
    runTaskClaim,
    runTaskCreate,
    runTaskList,
    runTaskUnclaim,
    runTaskUpdate,
    type TaskDeps,
} from './agent-task-actions.ts';

const statusFlag = {
    description: 'Task status filter or new status',
    name: '--status',
    valueName: '<status>',
};
const targetFlag = {
    description: "Channel or DM target, e.g. '#general' or 'dm:@zach'",
    name: '--target',
    valueName: '<target>',
};
const numberFlag = {
    description: 'Task number (repeatable on claim)',
    name: '--number',
    valueName: '<n>',
};

export function createTaskSubcommands(resolveDeps: () => TaskDeps): SubCommand[] {
    return [
        {
            examples: [
                'grotto task list',
                'grotto task list --target "#general" --status in_progress',
            ],
            flags: [targetFlag, statusFlag],
            name: 'list',
            positionals: [],
            run: (args) => runTaskList(args, resolveDeps()),
            summary: 'List task-messages across your chats or one target',
            usage: 'grotto task list [--target <target>] [--status all|todo|in_progress|in_review|done|closed]',
        },
        {
            examples: [
                'grotto task create --target "#general" <<\'GROTTOMSG\'\nInvestigate the failing nightly export.\nGROTTOMSG',
                'grotto task create --target "#general" --title "Phase 1: audit" --title "Phase 2: fix"',
            ],
            flags: [
                targetFlag,
                {
                    description: 'Task body per task (repeatable); otherwise the body is stdin',
                    name: '--title',
                    valueName: '<text>',
                },
                {
                    description:
                        'Assign to an Agent in the target; assigning yourself claims immediately',
                    name: '--assignee',
                    valueName: '<@handle>',
                },
            ],
            name: 'create',
            positionals: [],
            run: (args) => runTaskCreate(args, resolveDeps()),
            summary: 'Post a new message and publish it as a task',
            usage: 'grotto task create --target <target> [--title <text>]... [--assignee @agent]',
        },
        {
            examples: [
                'grotto task claim --target "#general" --number 1 --number 2',
                'grotto task claim --target "#general" --message-id 1a2b3c4d',
            ],
            flags: [
                targetFlag,
                numberFlag,
                {
                    description: 'Claim a regular message: converts it to a task you own',
                    name: '--message-id',
                    valueName: '<id>',
                },
            ],
            name: 'claim',
            positionals: [],
            run: (args) => runTaskClaim(args, resolveDeps()),
            summary: 'Claim tasks before working — the claim is the concurrency lock',
            usage: 'grotto task claim --target <target> (--number <n>... | --message-id <id>)',
        },
        {
            examples: ['grotto task unclaim --target "#general" --number 1'],
            flags: [targetFlag, numberFlag],
            name: 'unclaim',
            positionals: [],
            run: (args) => runTaskUnclaim(args, resolveDeps()),
            summary: 'Release a task you claimed',
            usage: 'grotto task unclaim --target <target> --number <n>',
        },
        {
            examples: ['grotto task update --target "#general" --number 1 --status in_review'],
            flags: [targetFlag, numberFlag, statusFlag],
            name: 'update',
            positionals: [],
            run: (args) => runTaskUpdate(args, resolveDeps()),
            summary:
                'Move a task through todo → in_progress → in_review → done (closed is reversible)',
            usage: 'grotto task update --target <target> --number <n> --status <status>',
        },
    ];
}
