import { expect, test } from 'bun:test';
import { buildSkillTreePaths, buildSkillTreeSubjects } from './skill-tree-model.ts';

test('buildSkillTreeSubjects maps installed skills into flat SKILL.md paths', () => {
    const subjects = buildSkillTreeSubjects({
        hubByName: new Map([
            [
                'browser',
                {
                    edited: true,
                    identifier: 'official/browser',
                    trustLevel: 'builtin',
                    updateAvailable: true,
                },
            ],
        ]),
        skills: [
            {
                allowedTools: null,
                dependencyState: 'ready',
                description: 'Reads pages',
                diagnostic: null,
                enabled: true,
                id: 'browser',
                missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                name: 'browser',
                readOnly: false,
                surface: 'agent',
                updatedAt: null,
                usability: 'enabled',
                version: null,
            },
        ],
    });

    expect(subjects.map((subject) => subject.treePath)).toEqual(['browser/SKILL.md']);
    expect(buildSkillTreePaths(subjects)).toContain('browser/');

    const installedBrowser = subjects.find((subject) => subject.treePath === 'browser/SKILL.md');
    expect(installedBrowser?.edited).toBe(true);
    expect(installedBrowser?.updateAvailable).toBe(true);
    expect(installedBrowser?.managedSource).toBe('hub');
});

test('buildSkillTreeSubjects sources managed flags from the runtime summary', () => {
    const subjects = buildSkillTreeSubjects({
        hubByName: new Map(),
        runtimeByName: new Map([
            ['tavern-agent', { edited: false, managedSource: 'seeded', updateAvailable: true }],
            ['tavern-workflow', { edited: true, managedSource: 'hub', updateAvailable: false }],
        ]),
        skills: [
            {
                allowedTools: null,
                dependencyState: 'ready',
                description: 'Seeded agent skill',
                diagnostic: null,
                enabled: true,
                id: 'tavern-agent',
                missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                name: 'tavern-agent',
                readOnly: false,
                surface: 'agent',
                updatedAt: null,
                usability: 'enabled',
                version: null,
            },
            {
                allowedTools: null,
                dependencyState: 'ready',
                description: 'Workflow guidance',
                diagnostic: null,
                enabled: true,
                id: 'tavern-workflow',
                missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                name: 'tavern-workflow',
                readOnly: false,
                surface: 'agent',
                updatedAt: null,
                usability: 'enabled',
                version: null,
            },
        ],
    });

    const seeded = subjects.find((subject) => subject.treePath === 'tavern-agent/SKILL.md');
    expect(seeded?.managedSource).toBe('seeded');
    expect(seeded?.updateAvailable).toBe(true);
    expect(seeded?.edited).toBe(false);

    const hub = subjects.find((subject) => subject.treePath === 'tavern-workflow/SKILL.md');
    expect(hub?.managedSource).toBe('hub');
    expect(hub?.edited).toBe(true);
    expect(hub?.updateAvailable).toBe(false);
});
