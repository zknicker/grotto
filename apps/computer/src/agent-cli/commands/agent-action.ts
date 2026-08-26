import fs from 'node:fs/promises';
import {
    actionCardActionSchema,
    agentActionPrepareReceiptSchema,
    avatarMaxBytes,
} from '@grotto/api';
import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';
import { assertAgentTarget } from './agent-command-utils.ts';

interface ActionDeps {
    client: AgentApiRequester;
    mintNonce(): string;
    readFile(filePath: string): Promise<Buffer>;
    readStdin(): Promise<string>;
    stat(filePath: string): Promise<{ isFile(): boolean; size: number }>;
    stdinIsTty(): boolean;
    write(text: string): void;
}

export const ACTION_SUBCOMMANDS: SubCommand[] = [
    {
        examples: [
            'printf \'{"kind":"agent:create","name":"Orbit"}\' | grotto action prepare --target "#product" --avatar-file ./orbit.png',
        ],
        flags: [
            { description: 'Existing Chat target', name: '--target', valueName: '<target>' },
            {
                description: 'Local PNG, JPEG, or WebP avatar',
                name: '--avatar-file',
                valueName: '<file>',
            },
        ],
        name: 'prepare',
        positionals: [],
        run: (args) => runActionPrepare(args, defaultDeps()),
        summary: 'Prepare a native Agent-creation action card',
        usage: 'grotto action prepare --target <target> --avatar-file <file>',
    },
];

export async function runActionPrepare(args: ParsedArgs, deps: ActionDeps): Promise<number> {
    const target = args.values['--target']?.trim();
    if (!target) {
        throw new AgentCliError('INVALID_ARG', '--target is required.');
    }
    assertAgentTarget(target);

    const avatarPath = args.values['--avatar-file']?.trim();
    if (!avatarPath) {
        throw new AgentCliError('INVALID_ARG', '--avatar-file is required.');
    }
    const avatar = await readAvatarFile(avatarPath, deps);

    if (deps.stdinIsTty()) {
        throw new AgentCliError('INVALID_ARG', 'Pipe one ActionCardAction JSON object on stdin.', {
            nextAction:
                'Run `printf \'{"kind":"agent:create","name":"Orbit"}\' | grotto action prepare ...`.',
        });
    }
    const rawAction = await deps.readStdin();
    let decoded: unknown;
    try {
        decoded = JSON.parse(rawAction);
    } catch {
        throw new AgentCliError('INVALID_ARG', 'stdin must contain valid ActionCardAction JSON.');
    }
    const action = actionCardActionSchema.safeParse(decoded);
    if (!action.success) {
        throw new AgentCliError(
            'INVALID_ARG',
            'stdin must be one valid ActionCardAction JSON object.'
        );
    }

    const response = await deps.client.request(
        '/api/agent/actions/prepare',
        agentActionPrepareReceiptSchema,
        {
            body: {
                action: action.data,
                avatar: {
                    bytesBase64: avatar.bytes.toString('base64'),
                    mediaType: avatar.mediaType,
                },
                nonce: deps.mintNonce(),
                target,
            },
            method: 'POST',
        }
    );
    deps.write(
        `Prepared ${response.action.kind} action ${response.action.id} in ${response.target} (${response.action.status}${response.idempotent ? ', idempotent' : ''}).\nMessage ID: ${response.messageId}\n`
    );
    return 0;
}

async function readAvatarFile(filePath: string, deps: ActionDeps) {
    let stats: Awaited<ReturnType<ActionDeps['stat']>>;
    try {
        stats = await deps.stat(filePath);
    } catch {
        throw new AgentCliError('INVALID_ARG', `File ${filePath} was not found.`);
    }
    if (!stats.isFile()) {
        throw new AgentCliError('INVALID_ARG', `${filePath} is not a file.`);
    }
    if (stats.size <= 0 || stats.size > avatarMaxBytes) {
        throw new AgentCliError('INVALID_ARG', 'The avatar file must be between 1 B and 512 KiB.');
    }

    let bytes: Buffer;
    try {
        bytes = await deps.readFile(filePath);
    } catch {
        throw new AgentCliError('INVALID_ARG', `File ${filePath} could not be read.`);
    }
    if (bytes.byteLength === 0 || bytes.byteLength > avatarMaxBytes) {
        throw new AgentCliError('INVALID_ARG', 'The avatar file must be between 1 B and 512 KiB.');
    }
    const mediaType = detectMediaType(bytes);
    if (!mediaType) {
        throw new AgentCliError(
            'INVALID_ARG',
            'The avatar file must be a PNG, JPEG, or WebP image.'
        );
    }
    return { bytes, mediaType };
}

function detectMediaType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return 'image/png';
    }
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
        return 'image/jpeg';
    }
    if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 4) === 'WEBP') {
        return 'image/webp';
    }
    return null;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
    return (
        bytes.byteLength >= signature.length &&
        signature.every((byte, index) => bytes[index] === byte)
    );
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
    return Buffer.from(bytes.subarray(offset, offset + length)).toString('ascii');
}

function defaultDeps(): ActionDeps {
    return {
        client: createAgentApiClient(),
        mintNonce: () => `action-${crypto.randomUUID()}`,
        readFile: (filePath) => fs.readFile(filePath),
        readStdin: async () => Bun.stdin.text(),
        stat: (filePath) => fs.stat(filePath),
        stdinIsTty: () => process.stdin.isTTY === true,
        write: (text) => process.stdout.write(text),
    };
}
