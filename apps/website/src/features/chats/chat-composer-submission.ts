import { compileMentionSubmission, normalizeMentions } from '../mentions/mention-text.ts';
import type { Mention } from '../mentions/mention-types.ts';

export function buildChatComposerSubmission({
    content,
    mentions,
}: {
    content: string;
    mentions: Mention[];
}) {
    const leadingTrimLength = content.length - content.trimStart().length;
    const submittedContent = content.trimStart();
    const submittedMentions = normalizeMentions(
        submittedContent,
        mentions.map((mention) => ({
            ...mention,
            end: mention.end - leadingTrimLength,
            start: mention.start - leadingTrimLength,
        }))
    );
    const submission = compileMentionSubmission(submittedContent, submittedMentions);

    return { content: submission.content.trim() };
}
