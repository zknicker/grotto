import type { ReferenceKind } from './mention-types.ts';

type MentionChipColor = 'accent' | 'default' | 'success';

const mentionChipColorByKind: Partial<Record<ReferenceKind, MentionChipColor>> = {
    agent: 'accent',
};

export function getMentionChipColor(kind: ReferenceKind): MentionChipColor {
    return mentionChipColorByKind[kind] ?? 'default';
}
