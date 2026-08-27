import type { ReferenceKind } from './mention-types.ts';

type MentionChipColor = 'accent' | 'default' | 'success' | 'warning';

const mentionChipColorByKind: Partial<Record<ReferenceKind, MentionChipColor>> = {
    agent: 'accent',
    skill: 'warning',
};

export function getMentionChipColor(kind: ReferenceKind): MentionChipColor {
    return mentionChipColorByKind[kind] ?? 'default';
}
