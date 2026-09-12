import { randomUUID } from 'node:crypto';
import { agentAskReceiptSchema, askOptionMaxLength, askOptionsMaxCount } from '@haus/api';
import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import { shortMessageId } from '../agent-format.ts';
import { isThreadTarget } from '../agent-render.ts';
import type { ParsedArgs } from '../parse.ts';
import { readAgentStdin } from '../stdin.ts';
import type { SubCommand } from '../subcommand.ts';
import { assertAgentTarget, requiredValue, valuesFor } from './agent-command-utils.ts';

const ASK_RECIPE = `haus ask --target "#product" --to @ada --title "Run the staged migration?" \\
  --summary "The migration is staged and reversible for one hour." \\
  --option "Run it now" --option "Wait for the release window" <<'HAUSMSG'
The migration is staged. Should I run it now, or wait for the release window?
HAUSMSG`;

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
        {
            description: `A reply the human can send as is; repeat up to ${askOptionsMaxCount} times, recommendation first`,
            name: '--option',
            valueName: '<text>',
        },
        {
            description: 'Removed',
            name: '--step',
            removed:
                '--step is gone. Offer replies with --option instead; the first one is your recommendation.',
            valueName: '<text>',
        },
    ],
    name: 'ask',
    notes: [
        'Leave --option off entirely to ask an open question the human answers in their own words.',
    ],
    positionals: [],
    run: (args) => runAsk(args, defaultDeps()),
    summary: 'Ask one human for a decision; the question body comes from stdin',
    usage: 'haus ask --target <target> --to @<handle> --title <text> --summary <text> [--option <text>]...',
};

export async function runAsk(args: ParsedArgs, deps: AskDeps): Promise<number> {
    const target = requiredValue(args, '--target');
    assertAgentTarget(target);
    const addresseeHandle = readHandle(args);
    const title = requiredValue(args, '--title');
    const summary = requiredValue(args, '--summary');
    const options = readOptions(args);

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
            options,
            summary,
            target,
            title,
        },
        method: 'POST',
    });

    const lines = [
        `Ask sent to ${receipt.target} for @${addresseeHandle}. Message ID: ${receipt.messageId}`,
    ];
    lines.push(
        receipt.ask.options.length > 0
            ? `Offered ${receipt.ask.options.length} ${receipt.ask.options.length === 1 ? 'option' : 'options'}, recommending "${receipt.ask.options[0]}".`
            : 'Offered no options; the human answers in their own words.'
    );
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

/**
 * Zero to four short replies, the first being the recommendation. Every rule the
 * Server enforces is checked here so a malformed Ask never costs a round trip.
 */
function readOptions(args: ParsedArgs): string[] {
    const options = valuesFor(args, '--option').map((option) => option.trim());
    if (options.length > askOptionsMaxCount) {
        throw new AgentCliError(
            'INVALID_ARG',
            `At most ${askOptionsMaxCount} --option values are allowed; ${options.length} were given.`,
            { nextAction: 'Keep the ways forward that differ, recommendation first.' }
        );
    }
    const empty = options.find((option) => option.length === 0);
    if (empty !== undefined) {
        throw new AgentCliError(
            'INVALID_ARG',
            '--option needs text the human can send as a reply.'
        );
    }
    const long = options.find((option) => option.length > askOptionMaxLength);
    if (long !== undefined) {
        throw new AgentCliError(
            'INVALID_ARG',
            `--option is at most ${askOptionMaxLength} characters; "${long}" is ${long.length}.`,
            { nextAction: 'An option is a reply, not an explanation. Put the detail in --summary.' }
        );
    }
    if (new Set(options).size !== options.length) {
        throw new AgentCliError('INVALID_ARG', 'Each --option must be distinct.');
    }
    return options;
}

/** `--to @ada` and `--to ada` name the same human; the Server resolves it. */
function readHandle(args: ParsedArgs): string {
    const raw = requiredValue(args, '--to');
    const handle = raw.startsWith('@') ? raw.slice(1) : raw;
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,30}$/u.test(handle)) {
        throw new AgentCliError('INVALID_ARG', `Invalid handle "${raw}".`, {
            nextAction: 'Use --to @handle. Run haus server info --humans to list handles.',
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
