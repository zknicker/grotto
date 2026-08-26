import fs from 'node:fs/promises';
import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import { agentAvatarGenerationResponseSchema } from '../agent-api-schemas.ts';
import { AgentCliError } from '../agent-error.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';

const avatarGenerationTimeoutMs = 75_000;

interface AvatarDeps {
    client: AgentApiRequester;
    write(text: string): void;
    writeFile(filePath: string, bytes: Uint8Array): Promise<void>;
}

export const AVATAR_SUBCOMMANDS: SubCommand[] = [
    {
        examples: [
            'grotto avatar generate --concept "a moonlit raccoon cartographer" --output ./avatar.png',
        ],
        flags: [
            {
                description: 'Short avatar concept (1–280 characters)',
                name: '--concept',
                valueName: '<text>',
            },
            { description: 'Local output file to create', name: '--output', valueName: '<path>' },
        ],
        name: 'generate',
        positionals: [],
        run: (args) => runAvatarGenerate(args, defaultDeps()),
        summary: 'Generate one validated avatar from a concept',
        usage: 'grotto avatar generate --concept <text> --output <path>',
    },
];

export async function runAvatarGenerate(args: ParsedArgs, deps: AvatarDeps): Promise<number> {
    const concept = args.values['--concept']?.trim();
    if (!concept) {
        throw new AgentCliError('INVALID_ARG', '--concept is required.');
    }
    const outputPath = args.values['--output']?.trim();
    if (!outputPath) {
        throw new AgentCliError('INVALID_ARG', '--output is required.');
    }

    const response = await deps.client.request(
        '/api/agent/avatar/generate',
        agentAvatarGenerationResponseSchema,
        { body: { concept }, method: 'POST', timeoutMs: avatarGenerationTimeoutMs }
    );
    const bytes = Buffer.from(response.avatar.bytesBase64, 'base64');
    if (bytes.byteLength !== response.avatar.byteSize) {
        throw new AgentCliError(
            'INVALID_JSON_RESPONSE',
            'The Server returned invalid avatar bytes.',
            {
                nextAction: 'Retry the command. If it fails again, check the Grotto Computer logs.',
            }
        );
    }
    try {
        await deps.writeFile(outputPath, bytes);
    } catch {
        throw new AgentCliError(
            'OUTPUT_WRITE_FAILED',
            `Could not write the avatar to ${outputPath}.`,
            {
                nextAction: 'Choose a writable local file path and retry.',
            }
        );
    }
    deps.write(
        `Generated avatar: ${outputPath} (${response.avatar.mediaType}, ${response.avatar.width}x${response.avatar.height}, ${response.avatar.byteSize} bytes)\n`
    );
    return 0;
}

function defaultDeps(): AvatarDeps {
    return {
        client: createAgentApiClient(),
        write: (text) => process.stdout.write(text),
        writeFile: (filePath, bytes) => fs.writeFile(filePath, bytes),
    };
}
