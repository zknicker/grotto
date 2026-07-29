import { expect, test } from 'bun:test';
import { selectAddableHostedSkills } from './hosted-agent-profile-tab.tsx';

test('Agent skill picker excludes same-name skills already in the Agent library', () => {
    const addable = selectAddableHostedSkills(
        [
            {
                description: 'Already owned',
                id: 'skl_owned',
                name: 'research',
                source: '~/.agents/skills/research',
            },
            {
                description: 'Can be added',
                id: 'skl_new',
                name: 'writing',
                source: '~/.agents/skills/writing',
            },
        ],
        [
            {
                description: 'Independent Agent copy',
                hash: 'a'.repeat(64),
                modifiedAt: '2026-07-28T20:00:00.000Z',
                name: 'research',
            },
        ]
    );

    expect(addable.map((skill) => skill.name)).toEqual(['writing']);
});
