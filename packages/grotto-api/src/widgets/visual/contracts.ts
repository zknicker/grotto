import * as z from 'zod';

/**
 * Generative visual: the fence body is model-authored HTML/SVG rendered in a
 * sandboxed opaque-origin iframe. The body is attacker-controlled content —
 * this schema enforces shape and size only; containment is the renderer's
 * sandbox (never allow-same-origin, CSP-pinned external sources).
 *
 * Authored as a ```visual fence (raw HTML body, optional info-string title),
 * not a widget:<name> JSON fence; it rides the widget render envelope for
 * persistence and replay.
 */

export const visualBodyLimit = 60_000;

export const widgetVisualPropsSchema = z
    .object({
        html: z.string().min(1).max(visualBodyLimit),
        title: z.string().trim().min(1).max(120).optional(),
    })
    .strict();

export type WidgetVisualProps = z.output<typeof widgetVisualPropsSchema>;

/**
 * Fallback text for a visual: explicit title, else the document's <title>,
 * else the first h1-h3 heading, else a generic label. Used for notification
 * previews, search, and the unavailable state.
 */
export function visualFallbackText(props: { html?: unknown; title?: unknown }): string {
    const title = typeof props.title === 'string' ? props.title.trim() : '';
    if (title) {
        return title.slice(0, 500);
    }

    const html = typeof props.html === 'string' ? props.html : '';
    const documentTitle = extractTagText(html, /<title[^>]*>([\s\S]*?)<\/title>/iu);
    if (documentTitle) {
        return documentTitle;
    }

    const heading = extractTagText(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/iu);
    return heading ?? 'Visual';
}

/**
 * The ```visual fence grammar, shared by Runtime (final-content parsing) and
 * the app (live streaming render): an optional info-string title after the
 * tag, then the raw HTML body up to the closing fence. A trailing unclosed
 * fence is a mid-stream visual whose body is still growing.
 */
export const closedVisualFencePattern =
    /^```visual(?:[ \t]+([^\n]*?))?[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*$/gmu;
export const openVisualFencePattern = /^```visual(?:[ \t]+([^\n]*?))?[ \t]*(?:\n([\s\S]*))?$/mu;

export type VisualFenceSegment =
    | { kind: 'text'; text: string }
    | { html: string; kind: 'visual'; open: boolean; title?: string };

/**
 * Split message content into prose and visual-fence segments, in order.
 * Closed fences yield complete visuals; a trailing unclosed fence yields an
 * open visual with the partial body streamed so far.
 */
export function splitVisualFences(content: string): VisualFenceSegment[] {
    const segments: VisualFenceSegment[] = [];
    let cursor = 0;

    for (const match of content.matchAll(closedVisualFencePattern)) {
        const index = match.index ?? 0;
        if (index > cursor) {
            segments.push({ kind: 'text', text: content.slice(cursor, index) });
        }
        segments.push(visualSegment(match[1], match[2] ?? '', false));
        cursor = index + match[0].length;
    }

    // Only the tail past the last closed fence can hold an unclosed fence.
    const tail = content.slice(cursor);
    const open = tail.match(openVisualFencePattern);

    if (open && typeof open.index === 'number') {
        if (open.index > 0) {
            segments.push({ kind: 'text', text: tail.slice(0, open.index) });
        }
        segments.push(visualSegment(open[1], open[2] ?? '', true));
    } else if (tail.length > 0) {
        segments.push({ kind: 'text', text: tail });
    }

    return segments;
}

function visualSegment(title: string | undefined, html: string, open: boolean): VisualFenceSegment {
    const trimmedTitle = title?.trim();
    return {
        html,
        kind: 'visual',
        open,
        ...(trimmedTitle ? { title: trimmedTitle } : {}),
    };
}

function extractTagText(html: string, pattern: RegExp): string | null {
    const match = html.match(pattern);
    if (!match?.[1]) {
        return null;
    }
    const text = match[1]
        .replace(/<[^>]*>/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
    return text.length > 0 ? text.slice(0, 500) : null;
}
