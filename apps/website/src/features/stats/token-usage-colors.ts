const runtimePresentation: Record<string, { colors: string[]; label: string }> = {
    'claude-code': {
        colors: ['var(--runtime-claude-1)', 'var(--runtime-claude-2)', 'var(--runtime-claude-3)'],
        label: 'Claude Code',
    },
    codex: {
        colors: ['var(--runtime-codex-1)', 'var(--runtime-codex-2)', 'var(--runtime-codex-3)'],
        label: 'Codex',
    },
    'grok-build': {
        colors: ['var(--runtime-grok-1)', 'var(--runtime-grok-2)', 'var(--runtime-grok-3)'],
        label: 'Grok',
    },
    pi: {
        colors: ['var(--runtime-pi-1)', 'var(--runtime-pi-2)', 'var(--runtime-pi-3)'],
        label: 'Pi',
    },
};

const configurationPalette = Object.values(runtimePresentation).flatMap(
    (presentation) => presentation.colors
);

export function runtimeUsageLabel(runtimeId: string) {
    return runtimePresentation[runtimeId]?.label ?? runtimeId;
}

export function tokenConfigurationColor(
    configuration: { id: string; runtimeId: string },
    usedColors: Set<string>
) {
    const preferredColors = runtimePresentation[configuration.runtimeId]?.colors ?? [];
    const candidates = [...preferredColors, ...configurationPalette];
    const offset = stableHash(configuration.id) % candidates.length;
    for (let index = 0; index < candidates.length; index += 1) {
        const color = candidates[(offset + index) % candidates.length];
        if (color && !usedColors.has(color)) {
            return color;
        }
    }
    return candidates[offset] ?? 'var(--runtime-other-1)';
}

function stableHash(value: string) {
    let hash = 0;
    for (const character of value) {
        hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return hash;
}
