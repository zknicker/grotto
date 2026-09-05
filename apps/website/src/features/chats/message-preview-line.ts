/**
 * Message content as one line of plain text: a rich reference or link reads as
 * its label (`#product`, `@Blippy`) rather than its Markdown target, Markdown
 * that only exists to shape a block — headings, bullets, emphasis, code ticks —
 * drops away, and newlines or code fences collapse to single spaces.
 *
 * Every surface that quotes a message without rendering it — a Thread preview
 * row, a Task's title, the Inbox, a Cloud Agent work's detail line — shares
 * this so they cannot disagree about what a quoted line says.
 */
export function messagePreviewLine(content: string) {
    return content
        .replace(markdownLinkPattern, (_match, label: string) => label)
        .replace(blockMarkerPattern, '')
        .replace(emphasisMarkerPattern, '')
        .replace(/\s+/gu, ' ')
        .trim();
}

/** Mirrors the link grammar `parseGrottoRichReferences` reads references from. */
const markdownLinkPattern = /\[([^\]\n]+)\]\((?:[^)\n]+)\)/gu;

/**
 * Heading and bullet markers, which only mean anything at the start of a line.
 * Both require the space Markdown itself requires, so a `#product` reference
 * and a bare `-5m` keep their first character.
 */
const blockMarkerPattern = /^[\t ]*(?:#{1,6}|[*+-])[\t ]+/gmu;

/** Emphasis and code ticks, which carry no meaning once the line is flat. */
const emphasisMarkerPattern = /\*\*|__|`/gu;
