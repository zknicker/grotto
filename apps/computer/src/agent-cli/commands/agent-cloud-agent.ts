import { randomUUID } from 'node:crypto';
import {
    agentCloudAgentCancelReceiptSchema,
    agentCloudAgentReceiptSchema,
    cloudAgentRepositorySchema,
    cloudAgentTitleSchema,
} from '@grotto/api';
import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import { shortMessageId } from '../agent-format.ts';
import { isThreadTarget } from '../agent-render.ts';
import type { ParsedArgs } from '../parse.ts';
import { readAgentStdin } from '../stdin.ts';
import type { SubCommand } from '../subcommand.ts';
import { assertAgentTarget, requiredValue } from './agent-command-utils.ts';

const START_RECIPE = `grotto cloud-agent start --target "#product" --repo grotto/grotto --ref main \\
  --title "Fix the flaky delivery test" \\
  --say "Handing the flaky delivery test to a cloud agent; I will report back." <<'GROTTOMSG'
Reproduce apps/server/test/agent-delivery.test.ts locally, find the race, and open a pull request.
GROTTOMSG`;

interface CloudAgentDeps {
    client: AgentApiRequester;
    mintNonce(): string;
    readStdin(): Promise<string>;
    stdinIsTty: boolean;
    write(text: string): void;
}

const START_COMMAND: SubCommand = {
    examples: [START_RECIPE],
    flags: [
        { description: 'Channel, DM, or thread target', name: '--target', valueName: '<target>' },
        { description: 'Repository as owner/name', name: '--repo', valueName: '<owner/name>' },
        { description: 'Starting ref (branch, tag, or SHA)', name: '--ref', valueName: '<ref>' },
        { description: 'One-line title for the work', name: '--title', valueName: '<text>' },
        { description: 'What you tell the chat you are doing', name: '--say', valueName: '<text>' },
    ],
    name: 'start',
    positionals: [],
    run: (args) => runCloudAgentStart(args, defaultDeps()),
    summary: 'Delegate bounded work to a cloud agent; the instructions come from stdin',
    usage: 'grotto cloud-agent start --target <target> --repo <owner/name> --ref <ref> --title <text> --say <text>',
};

const CANCEL_COMMAND: SubCommand = {
    examples: ['grotto cloud-agent cancel --work caw_9f2c1a0b7d4e6f81'],
    flags: [{ description: 'The work to cancel', name: '--work', valueName: '<workId>' }],
    name: 'cancel',
    positionals: [],
    run: (args) => runCloudAgentCancel(args, defaultDeps()),
    summary: 'Ask the provider to stop work you delegated',
    usage: 'grotto cloud-agent cancel --work <workId>',
};

export const CLOUD_AGENT_SUBCOMMANDS: SubCommand[] = [START_COMMAND, CANCEL_COMMAND];

export async function runCloudAgentStart(args: ParsedArgs, deps: CloudAgentDeps): Promise<number> {
    const target = requiredValue(args, '--target');
    assertAgentTarget(target);
    const repository = readRepository(args);
    const title = readTitle(args);
    const content = requiredValue(args, '--say');
    const startingRef = args.values['--ref']?.trim() || null;

    const instructions = deps.stdinIsTty ? '' : await deps.readStdin();
    if (!instructions.trim()) {
        throw new AgentCliError(
            'MISSING_CONTENT',
            'The instructions for the cloud agent are required on stdin.',
            { nextAction: START_RECIPE }
        );
    }

    const receipt = await deps.client.request(
        '/api/agent/cloud-agents',
        agentCloudAgentReceiptSchema,
        {
            body: {
                content: content.trim(),
                instructions: instructions.trimEnd(),
                nonce: deps.mintNonce(),
                repository,
                startingRef,
                target,
                title,
            },
            method: 'POST',
            timeoutMs: 60_000,
        }
    );

    const lines = [
        `Cloud agent started for ${repository}${startingRef ? `@${startingRef}` : ''}. Work ID: ${receipt.work.id}`,
        `Posted to ${receipt.target}. Message ID: ${receipt.messageId}`,
    ];
    lines.push(
        isThreadTarget(receipt.target)
            ? `(discussion continues in "${receipt.target}")`
            : `(discussion continues in this message's thread, target "${receipt.target}:${shortMessageId(receipt.messageId)}")`
    );
    lines.push('The result reaches your inbox when the run settles; post what you learn yourself.');
    deps.write(`${lines.join('\n')}\n`);
    return 0;
}

export async function runCloudAgentCancel(args: ParsedArgs, deps: CloudAgentDeps): Promise<number> {
    const workId = requiredValue(args, '--work');
    const receipt = await deps.client.request(
        '/api/agent/cloud-agents/cancel',
        agentCloudAgentCancelReceiptSchema,
        { body: { workId }, method: 'POST' }
    );
    deps.write(
        `Cancel requested for ${receipt.work.title} (${receipt.work.id}). The run settles as cancelled when the provider stops.\n`
    );
    return 0;
}

function readRepository(args: ParsedArgs): string {
    const raw = requiredValue(args, '--repo');
    const parsed = cloudAgentRepositorySchema.safeParse(raw);
    if (!parsed.success) {
        throw new AgentCliError('INVALID_ARG', `Invalid repository "${raw}".`, {
            nextAction: 'Use --repo owner/name, for example --repo grotto/grotto.',
        });
    }
    return parsed.data;
}

function readTitle(args: ParsedArgs): string {
    const raw = requiredValue(args, '--title');
    const parsed = cloudAgentTitleSchema.safeParse(raw);
    if (!parsed.success) {
        throw new AgentCliError('INVALID_ARG', 'The title must be 1 to 120 characters.', {
            nextAction: 'Give the work one short title a human can scan.',
        });
    }
    return parsed.data;
}

function defaultDeps(): CloudAgentDeps {
    return {
        client: createAgentApiClient(),
        mintNonce: () => `cloud-agent-${randomUUID()}`,
        readStdin: readAgentStdin,
        stdinIsTty: process.stdin.isTTY === true,
        write: (text) => process.stdout.write(text),
    };
}
