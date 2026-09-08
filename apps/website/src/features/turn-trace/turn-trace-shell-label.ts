/**
 * The one-line name for a shell call.
 *
 * A runtime types its own wrapper around whatever the model asked for — Codex
 * runs everything through `/bin/zsh -lc "…"` — and a heredoc opener drags the
 * whole document into the first line. Neither is what the Agent did, so the
 * row states the command itself and the body keeps the original verbatim.
 */

const labelMaxChars = 80;

const shellWrapper = /^(?:\S*\/)?(?:sh|bash|zsh|dash|ksh)\s+(-[a-z]+)\s+([\s\S]+)$/u;
const heredocOpener = /\s*<<-?\s*(['"]?)[A-Za-z_][\w-]*\1\s*$/u;
const doubleQuoteEscape = /\\(["$\\`])/gu;

/**
 * Real `grotto` commands, from the Agent CLI's own dispatcher
 * (`apps/computer/src/agent-cli.ts`). A Grotto verb is product activity that
 * happens to be typed at a shell, so it reads as the verb.
 */
const grottoVerbs: Record<string, string> = {
    ask: 'Asked a question with grotto',
    'inbox check': 'Checked inbox with grotto',
    'message check': 'Checked messages with grotto',
    'message react': 'Reacted to a message with grotto',
    'message read': 'Read messages with grotto',
    'message resolve': 'Looked up a message with grotto',
    'message search': 'Searched messages with grotto',
    'message send': 'Sent a message with grotto',
    'task claim': 'Claimed a task with grotto',
    'task create': 'Created a task with grotto',
    'task list': 'Listed tasks with grotto',
    'task unclaim': 'Released a task with grotto',
    'task update': 'Updated a task with grotto',
    'thread unfollow': 'Unfollowed a thread with grotto',
};

export function formatShellLabel(command: string): string {
    const summary = readShellCommandSummary(command);

    if (summary.length === 0) {
        return 'Ran a command';
    }

    return readGrottoVerb(summary) ?? `Ran ${clampLabel(summary)}`;
}

/** The command a person would recognize: unwrapped, first line, one space. */
export function readShellCommandSummary(command: string): string {
    const line = unwrapShellCommand(command)
        .split('\n')
        .map((entry) => entry.trim())
        .find((entry) => entry.length > 0);

    return (line ?? '').replace(heredocOpener, '').replace(/\s+/gu, ' ').trim();
}

export function unwrapShellCommand(command: string): string {
    const match = shellWrapper.exec(command.trim());
    const flags = match?.[1];
    const script = match?.[2];

    // `-l` and friends may precede it, but only `-c` means "the rest is the
    // script"; without it the argument is a file to run, not a command line.
    if (!(flags?.includes('c') && script)) {
        return command;
    }

    return readQuoted(script.trim());
}

function readQuoted(value: string): string {
    const quote = value.startsWith('"') ? '"' : value.startsWith("'") ? "'" : null;

    if (!quote) {
        return value;
    }

    const end = value.length > 1 && value.endsWith(quote) ? value.length - 1 : value.length;
    const inner = value.slice(1, end);

    return quote === '"' ? inner.replace(doubleQuoteEscape, '$1') : inner;
}

function readGrottoVerb(summary: string): string | null {
    if (!summary.startsWith('grotto ')) {
        return null;
    }

    const words = summary.slice('grotto '.length).split(' ');
    const group = words[0] ?? '';
    const subcommand = words[1]?.startsWith('-') ? '' : (words[1] ?? '');

    return grottoVerbs[`${group} ${subcommand}`.trim()] ?? grottoVerbs[group] ?? null;
}

function clampLabel(summary: string): string {
    return summary.length > labelMaxChars
        ? `${summary.slice(0, labelMaxChars - 1).trimEnd()}…`
        : summary;
}
