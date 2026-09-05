/**
 * Message content as one line of plain text: a rich reference or link reads as
 * its label (`#product`, `@Blippy`) rather than its Markdown target, and
 * newlines or code fences collapse to single spaces.
 *
 * Every surface that quotes a message without rendering it — a Thread preview
 * row, a Task's title, the Inbox — shares this so they cannot disagree about
 * what a referenced message says.
 */
export function messagePreviewLine(content: string) {
    return content
        .replace(markdownLinkPattern, (_match, label: string) => label)
        .replace(/\s+/gu, ' ')
        .trim();
}

/** Mirrors the link grammar `parseGrottoRichReferences` reads references from. */
const markdownLinkPattern = /\[([^\]\n]+)\]\((?:[^)\n]+)\)/gu;
