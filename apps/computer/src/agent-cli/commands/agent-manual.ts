import {
    hostedAgentManualGetResponseSchema,
    hostedAgentManualSearchResponseSchema,
} from '@tavern/api';
import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';

interface ManualDeps {
    client: AgentApiRequester;
    write(text: string): void;
}

export const MANUAL_SUBCOMMANDS: SubCommand[] = [
    {
        examples: [
            'grotto manual get grotto-cli-overview --intent "I need the operating guide" --reason "I am orienting this Agent"',
        ],
        flags: [
            {
                description: 'Why you need this topic (12–500 characters)',
                name: '--intent',
                valueName: '<text>',
            },
            {
                description: 'Why this lookup is justified (12–500 characters)',
                name: '--reason',
                valueName: '<text>',
            },
        ],
        name: 'get',
        positionals: ['<topic>'],
        run: (args) => runManualGet(args, defaultDeps()),
        summary: 'Read one complete Manual topic',
        usage: 'grotto manual get <topic> --intent <text> --reason <text>',
    },
    {
        examples: [
            'grotto manual search "claim task" --intent "I need matching guidance" --reason "I am choosing a safe procedure"',
        ],
        flags: [
            {
                description: 'Why you need this search (12–500 characters)',
                name: '--intent',
                valueName: '<text>',
            },
            {
                description: 'Why this lookup is justified (12–500 characters)',
                name: '--reason',
                valueName: '<text>',
            },
            {
                description: 'Restrict results to recipe topics',
                name: '--scope',
                valueName: '<scope>',
            },
            { description: 'Maximum number of results (1–20)', name: '--limit', valueName: '<n>' },
        ],
        allowExtraPositionals: true,
        name: 'search',
        positionals: ['<keywords>'],
        run: (args) => runManualSearch(args, defaultDeps()),
        summary: 'Find Manual topics by keywords',
        usage: 'grotto manual search <keywords> --intent <text> --reason <text> [--scope recipes]',
    },
];

export async function runManualGet(args: ParsedArgs, deps: ManualDeps): Promise<number> {
    const topic = args.positionals[0]?.trim();
    if (!topic) {
        throw new AgentCliError('INVALID_ARG', '<topic> is required.');
    }
    const response = await deps.client.request(
        '/api/agent/manual/get',
        hostedAgentManualGetResponseSchema,
        {
            query: {
                intent: requiredManualText(args, '--intent'),
                reason: requiredManualText(args, '--reason'),
                topic,
            },
        }
    );
    deps.write(`# ${response.topic.title}\n\n${response.topic.body.trimEnd()}\n`);
    return 0;
}

export async function runManualSearch(args: ParsedArgs, deps: ManualDeps): Promise<number> {
    const query = args.positionals.join(' ').trim();
    if (!query) {
        throw new AgentCliError('INVALID_ARG', '<keywords> is required.');
    }
    const scope = args.values['--scope'];
    if (scope !== undefined && scope !== 'recipes') {
        throw new AgentCliError('INVALID_ARG', '--scope must be recipes.');
    }
    const response = await deps.client.request(
        '/api/agent/manual/search',
        hostedAgentManualSearchResponseSchema,
        {
            query: {
                intent: requiredManualText(args, '--intent'),
                limit: args.values['--limit'],
                q: query,
                reason: requiredManualText(args, '--reason'),
                scope,
            },
        }
    );
    if (response.results.length === 0) {
        deps.write(`No Manual topics matched "${response.query}".\n`);
        return 0;
    }
    deps.write(
        `${response.results
            .map((result) => `${result.id} — ${result.title}\n  ${result.summary}`)
            .join('\n')}\n`
    );
    return 0;
}

function requiredManualText(args: ParsedArgs, flag: string): string {
    const value = args.values[flag]?.trim();
    if (!value) {
        throw new AgentCliError('INVALID_ARG', `${flag} is required.`);
    }
    if (value.length < 12 || value.length > 500) {
        throw new AgentCliError('INVALID_ARG', `${flag} must be 12–500 characters.`);
    }
    return value;
}

function defaultDeps(): ManualDeps {
    return {
        client: createAgentApiClient(),
        write: (text) => process.stdout.write(text),
    };
}
