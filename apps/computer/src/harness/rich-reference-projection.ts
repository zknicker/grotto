import { parseGrottoRichReferences, parseSkillReferenceTarget } from '@grotto/api/rich-references';

/**
 * Port of Runtime's skill-reference projection. Rich reference markdown stays
 * canonical in Server chat history; the addressed Agent receives only the
 * activation hint for skills that actually exist in its local library.
 */
export function projectMessageForAgent(input: {
    content: string;
    enabledSkillIds: readonly string[];
}) {
    const skillIds = resolveActiveReferencedSkillIds(input);
    if (skillIds.length === 0) {
        return input.content;
    }

    return [
        '<skill_reference_context>',
        'The user explicitly referenced these enabled skills for this turn. Use the normal runtime skill-loading mechanism for them:',
        '',
        ...skillIds.map((skillId) => `- ${skillId}`),
        '</skill_reference_context>',
        '',
        input.content,
    ]
        .join('\n')
        .trim();
}

function resolveActiveReferencedSkillIds(input: {
    content: string;
    enabledSkillIds: readonly string[];
}) {
    const enabledSkillIds = new Set(input.enabledSkillIds);
    const seen = new Set<string>();
    const skillIds: string[] = [];

    for (const reference of parseGrottoRichReferences(input.content)) {
        if (reference.kind !== 'skill' || reference.projection !== 'skill-activation') {
            continue;
        }

        const skillId = parseSkillReferenceTarget(reference.id);
        if (!(skillId && enabledSkillIds.has(skillId)) || seen.has(skillId)) {
            continue;
        }

        seen.add(skillId);
        skillIds.push(skillId);
    }

    return skillIds;
}
