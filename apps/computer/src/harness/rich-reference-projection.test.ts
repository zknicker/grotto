import { describe, expect, test } from 'bun:test';
import { projectHostedMessageForAgent } from './rich-reference-projection.ts';

describe('projectHostedMessageForAgent', () => {
    test('activates a referenced local skill while preserving canonical markdown', () => {
        const content = 'Please use [$agent-browser](skill://agent-browser) for this turn.';
        const projected = projectHostedMessageForAgent({
            content,
            enabledSkillIds: ['agent-browser'],
        });

        expect(projected).toContain('<skill_reference_context>');
        expect(projected).toContain('- agent-browser');
        expect(projected).toContain(content);
    });

    test('does not activate a skill absent from the addressed Agent library', () => {
        const content = 'Please use [$agent-browser](skill://agent-browser) for this turn.';

        expect(
            projectHostedMessageForAgent({
                content,
                enabledSkillIds: ['different-skill'],
            })
        ).toBe(content);
    });
});
