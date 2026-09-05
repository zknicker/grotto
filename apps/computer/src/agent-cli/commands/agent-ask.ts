import { randomUUID } from 'node:crypto';
import { agentAskReceiptSchema } from '@grotto/api';
import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import { shortMessageId } from '../agent-format.ts';
import { isThreadTarget } from '../agent-render.ts';
import type { ParsedArgs } from '../parse.ts';
import { readAgentStdin } from '../stdin.ts';
import type { SubCommand } from '../subcommand.ts';
import { assertAgentTarget, requiredValue } from './agent-command-utils.ts';

const ASK_RECIPE = `grotto ask --target "#product" --to @ada --title "Run the staged migration?" \\
  --summary "The migration is staged and reversible for one hour." \\
  --step "Approve the staged migration" <<'GROTTOMSG'
The migration is staged. Should I run it now, or wait for the release window?
GROTTOMSG`;

interface AskDeps {
    client: AgentApiRequester;
    mintNonce(): string;
    readStdin(): Promise<string>;
    stdinIsTty: boolean;
    write(text: string): void;
}

export const ASK_COMMAND: SubCommand = {
    examples: [ASK_RECIPE],
    flags: [
        { description: 'Channel, DM, or thread target', name: '--target', valueName: '<target>' },
        { description: 'The one human who must decide', name: '--to', valueName: '@<handle>' },
        { description: 'One-line decision title', name: '--title', valueName: '<text>' },
        { description: 'What the human needs to know', name: '--summary', valueName: '<text>' },
        { description: 'The step you recommend', name: '--step', valueName: '<text>' },
    ],
    name: 'ask',
    positionals: [],
    run: (args) => runAsk(args, defaultDeps()),
    summary: 'Ask one human for a decision; the question body comes from stdin',
    usage: 'grotto ask --target <target> --to @<handle> --title <text> --summary <text> --step <text>',
};

export async function runAsk(args: ParsedArgs, deps: AskDeps): Promise<number> {
    const target = requiredValue(args, '--target');
    assertAgentTarget(target);
    const addresseeHandle = readHandle(args);
    const title = requiredValue(args, '--title');
    const summary = requiredValue(args, '--summary');
    const recommendedStep = requiredValue(args, '--step');

    const content = deps.stdinIsTty ? '' : await deps.readStdin();
    if (!content.trim()) {
        throw new AgentCliError('MISSING_CONTENT', 'The question text is required on stdin.', {
            nextAction: ASK_RECIPE,
        });
    }

    const receipt = await deps.client.request('/api/agent/asks', agentAskReceiptSchema, {
        body: {
            addresseeHandle,
            content: content.trimEnd(),
            nonce: deps.mintNonce(),
            recommendedStep,
            summary,
            target,
            title,
        },
        method: 'POST',
    });

    const lines = [
        `Ask sent to ${receipt.target} for @${addresseeHandle}. Message ID: ${receipt.messageId}`,
    ];
    if (isThreadTarget(receipt.target)) {
        lines.push(`(the answer arrives in "${receipt.target}")`);
    } else {
        lines.push(
            `(the answer arrives in this message's thread, target "${receipt.target}:${shortMessageId(receipt.messageId)}")`
        );
    }
    deps.write(`${lines.join('\n')}\n`);
    return 0;
}

/** `--to @ada` and `--to ada` name the same human; the Server resolves it. */
function readHandle(args: ParsedArgs): string {
    const raw = requiredValue(args, '--to');
    const handle = raw.startsWith('@') ? raw.slice(1) : raw;
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,30}$/u.test(handle)) {
        throw new AgentCliError('INVALID_ARG', `Invalid handle "${raw}".`, {
            nextAction: 'Use --to @handle. Run grotto server info --humans to list handles.',
        });
    }
    return handle.toLowerCase();
}

function defaultDeps(): AskDeps {
    return {
        client: createAgentApiClient(),
        mintNonce: () => `ask-${randomUUID()}`,
        readStdin: readAgentStdin,
        stdinIsTty: process.stdin.isTTY === true,
        write: (text) => process.stdout.write(text),
    };
}
