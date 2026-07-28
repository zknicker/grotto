import * as z from 'zod';
import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';

interface ThreadDeps {
    client: AgentApiRequester;
    write(text: string): void;
}

const unfollowResponseSchema = z.object({
    target: z.string().min(1),
    unfollowed: z.literal(true),
});

export const THREAD_SUBCOMMANDS: SubCommand[] = [
    {
        examples: [
            'grotto thread unfollow --target "#general:1a2b3c4d"',
            'grotto thread unfollow --target "dm:@zach:1a2b3c4d" --reason "handed off to Wren"',
        ],
        flags: [
            {
                name: '--target',
                valueName: '<target>',
                description: "Thread target, e.g. '#general:1a2b3c4d' or 'dm:@peer:1a2b3c4d'",
            },
            {
                name: '--reason',
                valueName: '<text>',
                description: 'Short reason posted as a thread-local notice',
            },
        ],
        name: 'unfollow',
        positionals: [],
        run: (args) => runThreadUnfollow(args, defaultDeps()),
        summary: 'Remove a thread from your followed attention state',
        usage: 'grotto thread unfollow --target <target> [--reason <text>]',
    },
];

export async function runThreadUnfollow(args: ParsedArgs, deps: ThreadDeps): Promise<number> {
    const target = args.values['--target'];
    if (!target) {
        throw new AgentCliError('INVALID_ARG', 'Provide --target with a thread target.', {
            nextAction: 'grotto thread unfollow --target "#channel:<shortId>"',
        });
    }
    const response = await deps.client.request(
        '/api/agent/threads/unfollow',
        unfollowResponseSchema,
        {
            body: { reason: args.values['--reason'], target },
            method: 'POST',
        }
    );
    deps.write(
        [
            `Unfollowed ${response.target}. It no longer appears in your followed-thread attention state.`,
            'Current message delivery is unchanged.',
            'Posting in this thread re-follows you automatically.',
            '',
        ].join('\n')
    );
    return 0;
}

function defaultDeps(): ThreadDeps {
    return {
        client: createAgentApiClient(),
        write: (text) => process.stdout.write(text),
    };
}
