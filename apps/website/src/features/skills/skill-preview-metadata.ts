import type { SkillTreeSubject } from './skill-tree-model.ts';

export function parseSkillMarkdownMetadata(skillMd: string) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u.exec(skillMd);
    if (!match) {
        return { createdBy: null, keywords: [] };
    }

    const lines = match[1].split(/\r?\n/u);

    return {
        createdBy: formatCreatorLabel(
            readFrontmatterScalar(lines, ['author', 'created_by', 'createdBy'])
        ),
        keywords: readFrontmatterList(lines, ['keywords', 'tags']),
    };
}

export function stripFrontmatter(skillMd: string) {
    return skillMd.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/u, '');
}

export function mergeKeywords(...keywordGroups: string[][]) {
    const seen = new Set<string>();
    const keywords: string[] = [];

    for (const keyword of keywordGroups.flat()) {
        const normalized = keyword.trim();
        const key = normalized.toLowerCase();
        if (!normalized || seen.has(key)) {
            continue;
        }
        seen.add(key);
        keywords.push(normalized);
    }

    return keywords;
}

export function getSkillCreator(subject: SkillTreeSubject) {
    if (subject.trustLevel === 'builtin' || subject.sourceLabel === 'Built-in library') {
        return 'Grotto';
    }
    return subject.sourceLabel === 'Installed' ? 'User' : subject.sourceLabel;
}

export function formatSkillPreviewDate(value: null | string) {
    if (!value) {
        return 'Unknown';
    }

    const datePart = /^\d{4}-\d{2}-\d{2}/u.exec(value)?.[0];
    if (datePart) {
        return datePart;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function readFrontmatterScalar(lines: string[], keys: string[]) {
    for (const line of lines) {
        const trimmed = line.trim();
        const key = matchingFrontmatterKey(trimmed, keys);
        if (!key) {
            continue;
        }
        return cleanFrontmatterValue(trimmed.slice(key.length + 1));
    }
    return null;
}

function readFrontmatterList(lines: string[], keys: string[]) {
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index]?.trim() ?? '';
        const key = matchingFrontmatterKey(trimmed, keys);
        if (!key) {
            continue;
        }

        const inlineValue = trimmed.slice(key.length + 1).trim();
        if (inlineValue) {
            return splitFrontmatterValues(inlineValue);
        }

        const values: string[] = [];
        for (let itemIndex = index + 1; itemIndex < lines.length; itemIndex += 1) {
            const line = lines[itemIndex] ?? '';
            if (/^\S/u.test(line)) {
                break;
            }
            const item = line.trim();
            if (item.startsWith('- ')) {
                values.push(cleanFrontmatterValue(item.slice(2)));
            }
        }
        return values.filter(Boolean);
    }
    return [];
}

function matchingFrontmatterKey(line: string, keys: string[]) {
    return keys.find((candidate) => line.toLowerCase().startsWith(`${candidate.toLowerCase()}:`));
}

function splitFrontmatterValues(value: string) {
    return value
        .replace(/^\[/u, '')
        .replace(/\]$/u, '')
        .split(',')
        .map(cleanFrontmatterValue)
        .filter(Boolean);
}

function cleanFrontmatterValue(value: string) {
    return value
        .trim()
        .replace(/^['"]|['"]$/gu, '')
        .trim();
}

function formatCreatorLabel(value: null | string) {
    switch (value?.toLowerCase()) {
        case 'builtin':
            return 'Grotto';
        case 'community':
            return 'Community';
        case 'trusted':
            return 'Trusted';
        default:
            return value;
    }
}
