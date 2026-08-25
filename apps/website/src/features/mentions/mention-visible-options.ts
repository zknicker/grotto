import type { ActiveMentionQuery, MentionOption } from './mention-types.ts';

export function selectVisibleOptions({
    activeQuery,
    mentionOptions,
}: {
    activeQuery: ActiveMentionQuery | null;
    mentionOptions: MentionOption[];
}) {
    if (!activeQuery) {
        return [];
    }

    if (activeQuery.trigger === '$') {
        return mentionOptions.filter((option) => option.kind === 'skill');
    }

    return mentionOptions.filter((option) => option.kind === 'agent' || option.kind === 'user');
}
