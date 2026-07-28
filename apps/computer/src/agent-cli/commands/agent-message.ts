import { randomUUID } from 'node:crypto';
import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import {
    agentHistoryResponseSchema,
    agentMessageCheckResponseSchema,
    agentReactionResponseSchema,
    agentSendResponseSchema,
    resolvedAgentMessageSchema,
} from '../agent-api-schemas.ts';
import { AgentCliError } from '../agent-error.ts';
import { formatDeliveryEnvelope, formatHistoryLine, shortMessageId } from '../agent-format.ts';
import { renderHistory, renderSendResponse } from '../agent-render.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';
import {
    assertAgentTarget,
    optionalInteger,
    requiredValue,
    valuesFor,
} from './agent-command-utils.ts';
import { messageSearchSubcommand } from './agent-message-search.ts';

const HEREDOC_RECIPE = `grotto message send --target "#general" <<'GROTTOMSG'\nBody with "quotes", $vars, \`backticks\`.\nGROTTOMSG`;

interface MessageDeps {
    client: AgentApiRequester;
    compositionId?: string;
    mintNonce(): string;
    readStdin(): Promise<string>;
    stdinIsTty: boolean;
    write(text: string): void;
}

export const MESSAGE_SUBCOMMANDS: SubCommand[] = [
    {
        allowExtraPositionals: true,
        examples: [HEREDOC_RECIPE, 'grotto message send --send-draft --target "#general"'],
        flags: [
            {
                name: '--target',
                valueName: '<target>',
                description: 'Channel, DM, or thread target',
            },
            {
                name: '--attachment-id',
                valueName: '<id>',
                description: 'Attach an uploaded file (repeatable)',
            },
            { name: '--send-draft', description: 'Send the saved draft unchanged' },
            { name: '--anyway', description: 'Send a repeatedly held draft despite new activity' },
            { name: '--content', description: 'Unsupported; message bodies use stdin' },
        ],
        name: 'send',
        positionals: [],
        run: (args) => runSend(args, defaultDeps()),
        summary: 'Send a message body read only from stdin',
        usage: 'grotto message send --target <t> [--attachment-id <id> ...] [--send-draft] [--anyway]',
    },
    {
        examples: [
            'grotto message read --target "#general"',
            'grotto message read --target "#general" --after 42',
        ],
        flags: [
            {
                name: '--target',
                valueName: '<target>',
                description: 'Channel, DM, or thread target',
            },
            {
                name: '--before',
                valueName: '<id-or-seq>',
                description: 'Read before this message or sequence',
            },
            {
                name: '--after',
                valueName: '<id-or-seq>',
                description: 'Read after this message or sequence',
            },
            {
                name: '--around',
                valueName: '<id-or-seq>',
                description: 'Read around this message or sequence',
            },
            { name: '--limit', valueName: '<n>', description: 'Maximum messages to return' },
        ],
        name: 'read',
        positionals: [],
        run: (args) => runRead(args, defaultDeps()),
        summary: 'Read canonical history for one target',
        usage: 'grotto message read --target <t> [--before|--after|--around <idOrSeq>] [--limit <n>]',
    },
    messageSearchSubcommand,
    {
        examples: ['grotto message resolve msg_1a2b3c4d'],
        flags: [],
        name: 'resolve',
        positionals: ['<id>'],
        run: (args) => runResolve(args, defaultDeps()),
        summary: 'Resolve one canonical message by short or full id',
        usage: 'grotto message resolve <id>',
    },
    {
        examples: ['grotto message check'],
        flags: [],
        name: 'check',
        positionals: [],
        run: () => runCheck(defaultDeps()),
        summary: 'Read and acknowledge pending message deliveries',
        usage: 'grotto message check',
    },
    {
        examples: [
            'grotto message react --message-id 1a2b3c4d --emoji 👍',
            'grotto message react --message-id 1a2b3c4d --emoji 👍 --remove',
        ],
        flags: [
            { name: '--message-id', valueName: '<id>', description: 'Message to react to' },
            { name: '--emoji', valueName: '<e>', description: 'Reaction emoji' },
            { name: '--remove', description: 'Remove your matching reaction' },
        ],
        name: 'react',
        positionals: [],
        run: (args) => runReact(args, defaultDeps()),
        summary:
            'React only when a human asks or as a clear acknowledgement; never auto-react to routine events',
        usage: 'grotto message react --message-id <id> --emoji <e> [--remove]',
    },
];

export async function runCheck(deps: MessageDeps): Promise<number> {
    const response = await deps.client.request(
        '/api/agent/events',
        agentMessageCheckResponseSchema
    );
    const lines = response.messages.map((row) => formatDeliveryEnvelope(row.target, row.message));
    const trailer = response.more
        ? 'More messages are pending — run grotto message check again.'
        : 'No more new messages.';
    deps.write(`${[...lines, trailer].join('\n')}\n`);
    return 0;
}

export async function runSend(args: ParsedArgs, deps: MessageDeps): Promise<number> {
    if (args.flags['--content']) {
        throw heredocError('CONTENT_FLAG_UNSUPPORTED', '--content is not supported.');
    }
    if (args.positionals.length > 0) {
        throw heredocError(
            'POSITIONAL_CONTENT_UNSUPPORTED',
            'Positional message content is not supported.'
        );
    }
    const target = requiredValue(args, '--target');
    assertAgentTarget(target);
    const sendDraft = Boolean(args.flags['--send-draft']);
    const continueAnyway = Boolean(args.flags['--anyway']);
    const attachmentIds = valuesFor(args, '--attachment-id');
    if (continueAnyway && !sendDraft) {
        throw new AgentCliError(
            'SEND_DRAFT_ANYWAY_REQUIRES_SEND_DRAFT',
            '--anyway requires --send-draft.'
        );
    }
    if (sendDraft && attachmentIds.length > 0) {
        throw new AgentCliError(
            'SEND_DRAFT_ATTACHMENTS_UNSUPPORTED',
            '--send-draft does not accept --attachment-id.'
        );
    }
    const stdin = deps.stdinIsTty ? '' : await deps.readStdin();
    if (sendDraft && stdin.trim()) {
        throw new AgentCliError(
            'SEND_DRAFT_STDIN_UNSUPPORTED',
            '--send-draft does not accept stdin content.'
        );
    }
    if (!(sendDraft || stdin.trim())) {
        throw heredocError('MISSING_CONTENT', 'Message content is required on stdin.');
    }
    // One nonce per invocation keeps a re-driven send idempotent server-side.
    // No automatic transport retry: a lost held response must be re-driven by
    // the agent so the catch-up context is actually reviewed (spec §6).
    const response = await deps.client.request(
        '/api/agent/messages/send',
        agentSendResponseSchema,
        {
            body: {
                ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
                ...(deps.compositionId ? { compositionId: deps.compositionId } : {}),
                ...(sendDraft ? {} : { content: stdin }),
                ...(continueAnyway ? { continueAnyway: true } : {}),
                ...(sendDraft ? { sendDraft: true } : {}),
                nonce: deps.mintNonce(),
                target,
            },
            method: 'POST',
        }
    );
    deps.write(renderSendResponse(target, response));
    return 0;
}

export async function runRead(args: ParsedArgs, deps: MessageDeps): Promise<number> {
    const target = requiredValue(args, '--target');
    assertAgentTarget(target);
    const anchors = ['--before', '--after', '--around'].filter((flag) => args.values[flag]);
    if (anchors.length > 1) {
        throw new AgentCliError('INVALID_ARG', 'Use only one of --before, --after, or --around.');
    }
    const response = await deps.client.request('/api/agent/history', agentHistoryResponseSchema, {
        query: {
            after: args.values['--after'],
            around: args.values['--around'],
            before: args.values['--before'],
            limit: optionalInteger(args, '--limit', { minimum: 1 }),
            target,
        },
    });
    deps.write(renderHistory(response));
    return 0;
}

export async function runResolve(args: ParsedArgs, deps: MessageDeps): Promise<number> {
    const id = args.positionals[0];
    if (!id) {
        throw new AgentCliError('INVALID_ARG', 'A message id is required.');
    }
    const response = await deps.client.request(
        `/api/agent/messages/${encodeURIComponent(id)}`,
        resolvedAgentMessageSchema
    );
    deps.write(`${formatHistoryLine(response.message)}\n`);
    return 0;
}

export async function runReact(args: ParsedArgs, deps: MessageDeps): Promise<number> {
    const messageId = args.values['--message-id'];
    const emoji = args.values['--emoji'];
    if (!messageId) {
        throw new AgentCliError('INVALID_ARG', 'Provide --message-id.');
    }
    if (!emoji) {
        throw new AgentCliError('INVALID_ARG', 'Provide --emoji.');
    }
    const remove = Boolean(args.flags['--remove']);
    const response = await deps.client.request(
        '/api/agent/messages/react',
        agentReactionResponseSchema,
        { body: { emoji, messageId, ...(remove ? { remove: true } : {}) }, method: 'POST' }
    );
    deps.write(
        `${remove ? 'Removed' : 'Reacted'} ${emoji} ${remove ? 'from' : 'to'} msg ${shortMessageId(response.message.id)}.\n`
    );
    return 0;
}

function heredocError(code: string, message: string): AgentCliError {
    return new AgentCliError(code, message, { nextAction: HEREDOC_RECIPE });
}

function defaultDeps(): MessageDeps {
    return {
        client: createAgentApiClient(),
        compositionId: process.env.GROTTO_COMPOSITION_ID?.trim() || undefined,
        mintNonce: () => `cli-${randomUUID()}`,
        readStdin,
        stdinIsTty: Boolean(process.stdin.isTTY),
        write: (text) => process.stdout.write(text),
    };
}

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}

export const __test = { HEREDOC_RECIPE };
