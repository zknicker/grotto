export type GrottoRichReferenceKind =
    | 'agent'
    | 'app'
    | 'directory'
    | 'file'
    | 'plugin'
    | 'skill'
    | 'user';

export type GrottoRichReferenceProjection =
    | 'agent-reference'
    | 'capability-reference'
    | 'path-reference'
    | 'skill-activation'
    | 'user-reference';

export interface GrottoRichReference {
    end: number;
    id: string;
    kind: GrottoRichReferenceKind;
    label: string;
    projection: GrottoRichReferenceProjection;
    start: number;
    text: string;
}

export function formatAgentReferenceTarget(agentId: string) {
    return `agent://${encodeReferenceId(agentId)}`;
}

export function formatAppReferenceTarget(appId: string) {
    return `app://computer-use/${encodeReferenceId(appId)}`;
}

export function formatSkillReferenceTarget(skillId: string) {
    return `skill://${encodeReferenceId(skillId)}`;
}

export function formatUserReferenceTarget(userId: string) {
    return `user://${encodeReferenceId(userId)}`;
}

export function parseAgentReferenceTarget(target: string) {
    return parseSchemeReferenceTarget(target, 'agent');
}

export function parseAppReferenceTarget(target: string) {
    if (!target.startsWith('app://computer-use/')) {
        return null;
    }

    return decodeReferenceId(target.slice('app://computer-use/'.length));
}

export function parseSkillReferenceTarget(target: string) {
    return parseSchemeReferenceTarget(target, 'skill');
}

export function parseUserReferenceTarget(target: string) {
    return parseSchemeReferenceTarget(target, 'user');
}

export function parseGrottoRichReferences(content: string) {
    const references: GrottoRichReference[] = [];
    const linkPattern = /\[([^\]\n]+)\]\(([^)\n]+)\)/gu;

    for (const match of content.matchAll(linkPattern)) {
        const text = match[0];
        const rawLabel = match[1];
        const target = match[2].trim();
        const start = match.index;

        if (
            typeof text !== 'string' ||
            typeof rawLabel !== 'string' ||
            typeof target !== 'string' ||
            start === undefined
        ) {
            continue;
        }

        const reference = parseRichReferenceLink({ rawLabel, target });

        if (!reference) {
            continue;
        }

        references.push({
            ...reference,
            end: start + text.length,
            id: target,
            start,
            text,
        });
    }

    return references;
}

function parseRichReferenceLink({
    rawLabel,
    target,
}: {
    rawLabel: string;
    target: string;
}): Omit<GrottoRichReference, 'end' | 'id' | 'start' | 'text'> | null {
    if (parseAgentReferenceTarget(target)) {
        return {
            kind: 'agent',
            label: stripReferenceLabelSigil(rawLabel),
            projection: 'agent-reference',
        };
    }

    if (parseUserReferenceTarget(target)) {
        return {
            kind: 'user',
            label: stripReferenceLabelSigil(rawLabel),
            projection: 'user-reference',
        };
    }

    if (target.startsWith('plugin://')) {
        return {
            kind: 'plugin',
            label: stripReferenceLabelSigil(rawLabel),
            projection: 'capability-reference',
        };
    }

    if (parseAppReferenceTarget(target)) {
        return {
            kind: 'app',
            label: stripReferenceLabelSigil(rawLabel),
            projection: 'capability-reference',
        };
    }

    if (parseSkillReferenceTarget(target)) {
        return {
            kind: 'skill',
            label: stripReferenceLabelSigil(rawLabel),
            projection: 'skill-activation',
        };
    }

    if (target.startsWith('/')) {
        return {
            kind: inferPathKind(target),
            label: stripReferenceLabelSigil(rawLabel),
            projection: 'path-reference',
        };
    }

    return null;
}

function parseSchemeReferenceTarget(target: string, scheme: string) {
    const prefix = `${scheme}://`;

    if (!target.startsWith(prefix)) {
        return null;
    }

    return decodeReferenceId(target.slice(prefix.length));
}

function encodeReferenceId(id: string) {
    return encodeURIComponent(id.trim());
}

function decodeReferenceId(value: string) {
    if (!value) {
        return null;
    }

    try {
        return decodeURIComponent(value);
    } catch {
        return null;
    }
}

function stripReferenceLabelSigil(label: string) {
    return label.replace(/^[@$]/u, '');
}

function inferPathKind(target: string): Extract<GrottoRichReferenceKind, 'directory' | 'file'> {
    const finalSegment = target.split('/').filter(Boolean).at(-1) ?? '';

    if (/\.[A-Za-z0-9]+$/u.test(finalSegment)) {
        return 'file';
    }

    return 'directory';
}
