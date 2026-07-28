import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import {
    agentSkillChangeResponseSchema,
    agentSkillCreateResponseSchema,
    agentSkillDeleteResponseSchema,
    agentSkillListResponseSchema,
    agentSkillViewResponseSchema,
} from '../agent-api-schemas.ts';
import { AgentCliError } from '../agent-error.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';

const CONTENT_RECIPE = `<<'GROTTOMSG'\n<SKILL.md content>\nGROTTOMSG`;

interface SkillDeps {
    client: AgentApiRequester;
    readStdin(): Promise<string>;
    stdinIsTty(): boolean;
    write(text: string): void;
}

export const SKILL_SUBCOMMANDS: SubCommand[] = [
    {
        examples: ['grotto skill list'],
        flags: [],
        name: 'list',
        positionals: [],
        run: () => runSkillList(defaultDeps()),
        summary: 'List skills in your Agent library',
        usage: 'grotto skill list',
    },
    {
        examples: ['grotto skill view release-checks'],
        flags: [],
        name: 'view',
        positionals: ['<skillId>'],
        run: (args) => runSkillView(args, defaultDeps()),
        summary: 'Read a skill and the hashes needed to edit it',
        usage: 'grotto skill view <skillId>',
    },
    {
        examples: [
            `grotto skill create --name release-checks --description "Verify releases" ${CONTENT_RECIPE}`,
        ],
        flags: [
            { description: 'Skill name; becomes its id', name: '--name', valueName: '<name>' },
            {
                description: 'Short catalog description',
                name: '--description',
                valueName: '<text>',
            },
        ],
        name: 'create',
        positionals: [],
        run: (args) => runSkillCreate(args, defaultDeps()),
        summary: 'Create a skill from SKILL.md on stdin; prefer patching an existing skill',
        usage: 'grotto skill create --name <name> --description <text> < SKILL.md',
    },
    {
        examples: [`grotto skill patch release-checks --hash <hash> ${CONTENT_RECIPE}`],
        flags: [{ description: 'Hash from skill view', name: '--hash', valueName: '<hash>' }],
        name: 'patch',
        positionals: ['<skillId>'],
        run: (args) => runSkillPatch(args, defaultDeps()),
        summary: 'Replace SKILL.md from stdin using its current hash',
        usage: 'grotto skill patch <skillId> --hash <hash> < SKILL.md',
    },
    {
        examples: [
            `grotto skill write-file release-checks --file-path references/checklist.md ${CONTENT_RECIPE}`,
        ],
        flags: [
            {
                description: 'Path under references/, templates/, scripts/, or assets/',
                name: '--file-path',
                valueName: '<path>',
            },
            {
                description: 'Current file hash; omit when creating',
                name: '--hash',
                valueName: '<hash>',
            },
        ],
        name: 'write-file',
        positionals: ['<skillId>'],
        run: (args) => runSkillWriteFile(args, defaultDeps()),
        summary: 'Write a support file from stdin with hash checking',
        usage: 'grotto skill write-file <skillId> --file-path <path> [--hash <hash>] < file',
    },
    {
        examples: ['grotto skill delete release-checks'],
        flags: [],
        name: 'delete',
        positionals: ['<skillId>'],
        run: (args) => runSkillDelete(args, defaultDeps()),
        summary: 'Delete a skill from your library; this cannot be undone',
        usage: 'grotto skill delete <skillId>',
    },
];

export async function runSkillList(deps: SkillDeps): Promise<number> {
    const response = await deps.client.request('/api/agent/skills', agentSkillListResponseSchema);
    const lines = response.skills.map((skill) => `${skill.id} — ${skill.description}`);
    deps.write(`${lines.length > 0 ? lines.join('\n') : 'No skills found.'}\n`);
    deps.write(
        'View before editing: grotto skill view <skillId>; prefer grotto skill patch. Changes take effect next turn.\n'
    );
    return 0;
}

export async function runSkillView(args: ParsedArgs, deps: SkillDeps): Promise<number> {
    const skillId = requireSkillId(args);
    const response = await deps.client.request(
        `/api/agent/skills/${encodeURIComponent(skillId)}`,
        agentSkillViewResponseSchema
    );
    deps.write(response.content.endsWith('\n') ? response.content : `${response.content}\n`);
    deps.write(`\nHash: ${response.hash}\n`);
    if (response.supportFiles.length > 0) {
        deps.write('Support files:\n');
        for (const file of response.supportFiles) {
            deps.write(`- ${file.path} (hash: ${file.hash})\n`);
        }
    }
    deps.write(`Patch it: grotto skill patch ${skillId} --hash ${response.hash} < SKILL.md\n`);
    return 0;
}

export async function runSkillCreate(args: ParsedArgs, deps: SkillDeps): Promise<number> {
    const name = args.values['--name'];
    const description = args.values['--description'];
    if (!(name && description)) {
        throw new AgentCliError('INVALID_ARG', 'Provide --name and --description.');
    }
    const content = await requiredStdin(deps, 'grotto skill create');
    const response = await deps.client.request(
        '/api/agent/skills/create',
        agentSkillCreateResponseSchema,
        { body: { content, description, name }, method: 'POST' }
    );
    deps.write(`Created skill ${response.skill.id}. Changes take effect next turn.\n`);
    return 0;
}

export async function runSkillPatch(args: ParsedArgs, deps: SkillDeps): Promise<number> {
    const skillId = requireSkillId(args);
    const expectedHash = args.values['--hash'];
    if (!expectedHash) {
        throw new AgentCliError('INVALID_ARG', 'Provide --hash from grotto skill view.');
    }
    const content = await requiredStdin(deps, `grotto skill patch ${skillId}`);
    const response = await deps.client.request(
        '/api/agent/skills/patch',
        agentSkillChangeResponseSchema,
        { body: { content, expectedHash, skillId }, method: 'POST' }
    );
    deps.write(
        `Patched ${skillId}. New hash: ${response.change.afterHash}. Changes take effect next turn.\n`
    );
    return 0;
}

export async function runSkillWriteFile(args: ParsedArgs, deps: SkillDeps): Promise<number> {
    const skillId = requireSkillId(args);
    const filePath = args.values['--file-path'];
    if (!filePath) {
        throw new AgentCliError('INVALID_ARG', 'Provide --file-path.');
    }
    const content = await stdin(deps, `grotto skill write-file ${skillId}`);
    const response = await deps.client.request(
        '/api/agent/skills/write-file',
        agentSkillChangeResponseSchema,
        {
            body: {
                content,
                expectedHash: args.values['--hash'] ?? null,
                filePath,
                skillId,
            },
            method: 'POST',
        }
    );
    deps.write(
        `Wrote ${response.change.path}. New hash: ${response.change.afterHash}. Changes take effect next turn.\n`
    );
    return 0;
}

export async function runSkillDelete(args: ParsedArgs, deps: SkillDeps): Promise<number> {
    const skillId = requireSkillId(args);
    const response = await deps.client.request(
        `/api/agent/skills/${encodeURIComponent(skillId)}`,
        agentSkillDeleteResponseSchema,
        { method: 'DELETE' }
    );
    deps.write(
        `Deleted ${response.deleted.skillId} from your library. Changes take effect next turn.\n`
    );
    return 0;
}

function requireSkillId(args: ParsedArgs): string {
    const skillId = args.positionals[0];
    if (!skillId) {
        throw new AgentCliError('INVALID_ARG', 'A skill id is required.');
    }
    return skillId;
}

async function requiredStdin(deps: SkillDeps, command: string): Promise<string> {
    const content = await stdin(deps, command);
    if (!content.trim()) {
        throw new AgentCliError('MISSING_CONTENT', 'SKILL.md content from stdin was empty.');
    }
    return content;
}

async function stdin(deps: SkillDeps, command: string): Promise<string> {
    if (deps.stdinIsTty()) {
        throw new AgentCliError('MISSING_CONTENT', 'Skill content must be provided on stdin.', {
            nextAction: `${command} <<'GROTTOMSG'\n<content>\nGROTTOMSG`,
        });
    }
    return await deps.readStdin();
}

function defaultDeps(): SkillDeps {
    return {
        client: createAgentApiClient(),
        readStdin: async () => {
            let data = '';
            for await (const chunk of process.stdin) {
                data += chunk;
            }
            return data;
        },
        stdinIsTty: () => process.stdin.isTTY === true,
        write: (text) => process.stdout.write(text),
    };
}
