import { describe, expect, test, vi } from 'vitest';
import type { AgentApiRequester } from '../agent-api-client.ts';
import type { ParsedArgs } from '../parse.ts';
import { runSkillCreate, runSkillDelete } from './agent-skill.ts';

describe('agent skill commands', () => {
    test('reads create content from stdin and rejects TTY input', async () => {
        const request = vi.fn(async () => ({
            skill: {
                description: 'Audit carefully',
                editable: true,
                enabledForYou: true,
                id: 'audit',
                name: 'audit',
            },
        }));
        const output: string[] = [];
        const deps: Parameters<typeof runSkillCreate>[1] = {
            client: { request: request as unknown as AgentApiRequester['request'] },
            readStdin: async () => '# Audit\n',
            stdinIsTty: () => false,
            write: (text) => output.push(text),
        };

        await expect(runSkillCreate(args(), deps)).resolves.toBe(0);
        expect(request).toHaveBeenCalledWith('/api/agent/skills/create', expect.anything(), {
            body: {
                content: '# Audit\n',
                description: 'Audit carefully',
                name: 'Audit',
            },
            method: 'POST',
        });
        expect(output.join('')).toContain('Changes take effect next session.');

        deps.stdinIsTty = () => true;
        await expect(runSkillCreate(args(), deps)).rejects.toMatchObject({
            code: 'MISSING_CONTENT',
        });
    });

    test('sends a DELETE for the named skill and reports the removal', async () => {
        const request = vi.fn(async () => ({ deleted: { agentId: 'agt', skillId: 'audit' } }));
        const output: string[] = [];
        const deps: Parameters<typeof runSkillDelete>[1] = {
            client: { request: request as unknown as AgentApiRequester['request'] },
            readStdin: async () => '',
            stdinIsTty: () => true,
            write: (text) => output.push(text),
        };
        const deleteArgs: ParsedArgs = {
            flags: {},
            help: false,
            positionals: ['audit'],
            valueLists: {},
            values: {},
        };

        await expect(runSkillDelete(deleteArgs, deps)).resolves.toBe(0);
        expect(request).toHaveBeenCalledWith('/api/agent/skills/audit', expect.anything(), {
            method: 'DELETE',
        });
        expect(output.join('')).toContain('Deleted audit from your library.');
    });
});

function args(): ParsedArgs {
    return {
        flags: {},
        help: false,
        positionals: [],
        valueLists: {},
        values: { '--description': 'Audit carefully', '--name': 'Audit' },
    };
}
