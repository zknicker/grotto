import { readSkillSource, resolveSkillSource, type SkillSource, sha256 } from '../skills/store.ts';
import { bundledHubSkillContent } from './bundled-hub-skills.ts';

export interface SkillSummarySource {
    installedHash: string | null;
    source: SkillSource;
}

export function tryReadSkillSummarySource(skillId: string): SkillSummarySource | null {
    try {
        const source = readSkillSource(skillId);
        return source
            ? {
                  installedHash: source.installedHash,
                  source: source.source,
              }
            : null;
    } catch (error) {
        if (error instanceof Error && error.message.includes('Database not initialized')) {
            return null;
        }
        throw error;
    }
}

export function tryResolveSkillSource(input: { seededSkillId: string; skillId: string }) {
    return (
        tryReadSkillSummarySource(input.skillId)?.source ??
        tryResolveFallbackSkillSource(input.skillId, input.seededSkillId)
    );
}

export function managedSkillSummaryState(input: {
    content: string;
    defaultSeededContent: string;
    seededSkillId: string;
    skillId: string;
    skillSource: SkillSummarySource | null;
}) {
    const source =
        input.skillSource?.source ??
        tryResolveFallbackSkillSource(input.skillId, input.seededSkillId);
    const installedHash = input.skillSource?.installedHash ?? null;
    const managedSource = managedSkillSource({
        seededSkillId: input.seededSkillId,
        skillId: input.skillId,
        source,
    });
    const pristineContent = pristineManagedSkillContent({
        defaultSeededContent: input.defaultSeededContent,
        managedSource,
        skillId: input.skillId,
    });

    return {
        edited: installedHash !== null && sha256(input.content) !== installedHash,
        managedSource,
        updateAvailable:
            installedHash !== null &&
            pristineContent !== null &&
            sha256(pristineContent) !== installedHash,
    };
}

function tryResolveFallbackSkillSource(skillId: string, seededSkillId: string) {
    try {
        return resolveSkillSource(skillId);
    } catch (error) {
        if (error instanceof Error && error.message.includes('Database not initialized')) {
            return skillId === seededSkillId ? 'seeded' : 'external';
        }
        throw error;
    }
}

function managedSkillSource(input: {
    seededSkillId: string;
    skillId: string;
    source: SkillSource;
}) {
    if (input.source === 'seeded' || input.skillId === input.seededSkillId) {
        return 'seeded';
    }
    if (input.source === 'hub') {
        return input.source;
    }
    return null;
}

function pristineManagedSkillContent(input: {
    defaultSeededContent: string;
    managedSource: ReturnType<typeof managedSkillSource>;
    skillId: string;
}) {
    if (input.managedSource === 'seeded') {
        return input.defaultSeededContent;
    }
    if (input.managedSource === 'hub') {
        return bundledHubSkillContent(input.skillId);
    }
    return null;
}
