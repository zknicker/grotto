import type { ActiveMentionQuery, Mention, MentionOption } from './mention-types.ts';

export function getActiveMentionQuery(
    content: string,
    caretIndex: number | null
): ActiveMentionQuery | null {
    if (caretIndex === null || caretIndex < 1 || caretIndex > content.length) {
        return null;
    }

    const beforeCaret = content.slice(0, caretIndex);
    // `@` addresses agents; `$` references skills; `#` references channels.
    // All three trigger at start-of-input or after whitespace.
    const mentionMatch = /(?:^|\s)([@$#])([^\s@$#]*)$/u.exec(beforeCaret);

    if (mentionMatch?.index !== undefined) {
        const trigger = mentionMatch[1] === '$' || mentionMatch[1] === '#' ? mentionMatch[1] : '@';
        return {
            end: caretIndex,
            query: mentionMatch[2] ?? '',
            start: mentionMatch.index + (/^[@$#]/u.test(mentionMatch[0]) ? 0 : 1),
            trigger,
        };
    }

    return null;
}

export function reconcileMentions(
    previousContent: string,
    nextContent: string,
    mentions: readonly Mention[]
) {
    const change = getTextChange(previousContent, nextContent);

    return normalizeMentions(
        nextContent,
        mentions.flatMap((mention) => {
            if (change.start >= mention.end) {
                return [mention];
            }

            if (change.previousEnd <= mention.start) {
                return [
                    {
                        ...mention,
                        end: mention.end + change.delta,
                        start: mention.start + change.delta,
                    },
                ];
            }

            return [];
        })
    );
}

export function normalizeMentions(content: string, mentions: readonly Mention[]) {
    const sorted = [...mentions].sort((a, b) => a.start - b.start || a.end - b.end);
    const normalized: Mention[] = [];
    let previousEnd = 0;

    for (const mention of sorted) {
        if (
            mention.start < previousEnd ||
            mention.start < 0 ||
            mention.end > content.length ||
            mention.end <= mention.start ||
            content.slice(mention.start, mention.end) !== mention.text
        ) {
            continue;
        }

        normalized.push(mention);
        previousEnd = mention.end;
    }

    return normalized;
}

export function compileMentionSubmission(content: string, mentions: readonly Mention[]) {
    const normalized = normalizeMentions(content, mentions);

    if (normalized.length === 0) {
        return { content, mentions: [] };
    }

    const compiledMentions: Mention[] = [];
    let compiledContent = '';
    let cursor = 0;

    for (const mention of normalized) {
        compiledContent += content.slice(cursor, mention.start);

        const text = formatMentionText(mention);
        const start = compiledContent.length;

        compiledContent += text;
        compiledMentions.push({
            ...mention,
            end: start + text.length,
            start,
            text,
        });
        cursor = mention.end;
    }

    compiledContent += content.slice(cursor);

    return {
        content: compiledContent,
        mentions: compiledMentions,
    };
}

export function selectMention(input: {
    activeQuery: ActiveMentionQuery;
    content: string;
    mentions: readonly Mention[];
    option: MentionOption;
}) {
    const { activeQuery, content, mentions, option } = input;
    const before = content.slice(0, activeQuery.start);
    const after = content.slice(activeQuery.end);
    const text = option.insertText;
    const suffix = after.length === 0 || /^\S/u.test(after) ? ' ' : '';
    const nextContent = `${before}${text}${suffix}${after}`;
    const mention: Mention = {
        end: activeQuery.start + text.length,
        id: option.id,
        kind: option.kind,
        label: option.label,
        metadata: option.metadata,
        projection: option.projection,
        start: activeQuery.start,
        text,
    };
    const delta = text.length + suffix.length - (activeQuery.end - activeQuery.start);
    const nextMentions = normalizeMentions(nextContent, [
        ...mentions.flatMap((entry) => {
            if (entry.end <= activeQuery.start) {
                return [entry];
            }

            if (entry.start >= activeQuery.end) {
                return [
                    {
                        ...entry,
                        end: entry.end + delta,
                        start: entry.start + delta,
                    },
                ];
            }

            return [];
        }),
        mention,
    ]);

    return {
        nextCaretIndex: mention.end + suffix.length,
        nextContent,
        nextMentions,
    };
}

function formatMentionText(mention: Mention) {
    const label = formatMentionLabel(mention);

    if (mention.id.includes('://') || mention.id.startsWith('/')) {
        return `[${label}](${mention.id})`;
    }

    return label;
}

function formatMentionLabel(mention: Mention) {
    if (mention.kind === 'skill') {
        return `$${mention.text}`;
    }

    if (
        mention.kind === 'agent' ||
        mention.kind === 'app' ||
        mention.kind === 'plugin' ||
        mention.kind === 'user'
    ) {
        return mention.label.startsWith('@') ? mention.label : `@${mention.label}`;
    }

    if (mention.kind === 'chat') {
        return mention.label.startsWith('#') ? mention.label : `#${mention.label}`;
    }

    return mention.label;
}

function getTextChange(previousContent: string, nextContent: string) {
    let start = 0;

    while (
        start < previousContent.length &&
        start < nextContent.length &&
        previousContent[start] === nextContent[start]
    ) {
        start += 1;
    }

    let previousEnd = previousContent.length;
    let nextEnd = nextContent.length;

    while (
        previousEnd > start &&
        nextEnd > start &&
        previousContent[previousEnd - 1] === nextContent[nextEnd - 1]
    ) {
        previousEnd -= 1;
        nextEnd -= 1;
    }

    return {
        delta: nextEnd - previousEnd,
        previousEnd,
        start,
    };
}
