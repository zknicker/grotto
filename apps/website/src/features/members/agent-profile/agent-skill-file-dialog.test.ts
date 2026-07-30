import { expect, test } from 'bun:test';
import { isAgentSkillFileDirty } from './agent-skill-file-dialog.tsx';

test('Agent skill save enables only when SKILL.md content changes', () => {
    expect(isAgentSkillFileDirty('# Skill\n', '# Skill\n')).toBe(false);
    expect(isAgentSkillFileDirty('# Changed\n', '# Skill\n')).toBe(true);
});
