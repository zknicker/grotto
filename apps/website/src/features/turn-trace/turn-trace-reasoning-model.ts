/**
 * What a collapsed reasoning block says about itself.
 *
 * Codex emits complete summaries rather than a live stream, so a block starts
 * and ends in the same millisecond and its first line is the model's own title
 * for the thought. A duration is the wrong label for that — `Thought for 0ms`
 * measures the relay, not the thinking — so the title becomes the trigger, and
 * only a pause long enough to be worth reporting is timed.
 */

export interface TurnTraceReasoningPresentation {
    readonly body: string;
    /** Whether `body` is markdown the safe renderer should format. */
    readonly formatted: boolean;
    readonly label: string;
}

const titleMaxChars = 72;

/** Under a second is the relay's own latency; nobody waited on it. */
const shortestTimedThought = 1000;

const titleHeading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u;
const titleBold = /^\s*(?:\*\*|__)(.+?)(?:\*\*|__)\s*$/u;

export function readReasoningPresentation(input: {
    duration: string | null;
    durationMs: number | null;
    isStreaming: boolean;
    text: string;
}): TurnTraceReasoningPresentation {
    const text = input.text.trim();

    if (input.isStreaming) {
        return { body: text, formatted: true, label: 'Thinking…' };
    }

    return readTitledReasoning(text) ?? readTimedReasoning(input, text);
}

/** The model's own title for the block, when its first line is one. */
function readTitledReasoning(text: string): TurnTraceReasoningPresentation | null {
    const [first = '', ...rest] = text.split('\n');
    const title = readReasoningTitle(first);

    if (!title) {
        return null;
    }

    const body = rest.join('\n').trim();
    // A title with nothing under it is the whole thought. It stays as written
    // rather than rendering as a lone heading twice the size of the trigger.
    return body
        ? { body, formatted: true, label: title }
        : { body: title, formatted: false, label: title };
}

export function readReasoningTitle(line: string): string | null {
    const phrase = (titleHeading.exec(line)?.[1] ?? titleBold.exec(line)?.[1])?.trim();

    // A lazy match against a line carrying two bold runs would swallow the text
    // between them; a whole-line phrase has no markers left inside it.
    if (!phrase || phrase.includes('**') || phrase.includes('__')) {
        return null;
    }

    return phrase.length > titleMaxChars
        ? `${phrase.slice(0, titleMaxChars - 1).trimEnd()}…`
        : phrase;
}

function readTimedReasoning(
    input: { duration: string | null; durationMs: number | null },
    text: string
): TurnTraceReasoningPresentation {
    const timed =
        input.duration !== null &&
        input.durationMs !== null &&
        input.durationMs >= shortestTimedThought;

    return {
        body: text,
        formatted: true,
        label: timed ? `Thought for ${input.duration}` : 'Thought',
    };
}

export function readReasoningDurationMs(startedAt: string, endedAt: string | null): number | null {
    if (!endedAt) {
        return null;
    }

    const started = Date.parse(startedAt);
    const ended = Date.parse(endedAt);

    return Number.isNaN(started) || Number.isNaN(ended) ? null : Math.max(0, ended - started);
}
