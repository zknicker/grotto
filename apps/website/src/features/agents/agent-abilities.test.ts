import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentListOutput, SkillListOutput } from '../../lib/trpc.tsx';
import { selectAddableSkills, selectAgentSkills } from './agent-abilities.ts';

const skills = [
    createSkill('skill_enabled', 'enabled'),
    createSkill('skill_disabled', 'disabled'),
] satisfies SkillListOutput['skills'];
const agent = {
    enabledSkillIds: ['skill_enabled'],
} as AgentListOutput['agents'][number];

test('selectAgentSkills returns assigned skills', () => {
    assert.deepEqual(
        selectAgentSkills(skills, agent).map((skill) => skill.id),
        ['skill_enabled']
    );
});

test('selectAddableSkills excludes assigned and disabled skills', () => {
    assert.deepEqual(selectAddableSkills(skills, agent), []);
});

function createSkill(
    id: string,
    usability: SkillListOutput['skills'][number]['usability']
): SkillListOutput['skills'][number] {
    return {
        allowedTools: null,
        dependencyState: 'ready',
        description: id,
        diagnostic: null,
        enabled: usability === 'enabled',
        id,
        missing: {
            anyBins: [],
            bins: [],
            config: [],
            env: [],
            os: [],
        },
        name: id,
        readOnly: false,
        surface: 'agent',
        updatedAt: null,
        usability,
        version: null,
    };
}
