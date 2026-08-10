import type { ComputerUpdateStatus } from './update-check.ts';

/**
 * Dependency-free terminal styling for the grotto-computer command surface.
 * Glyph prefixes (✓ ✗ ● ·) always print so piped output stays legible;
 * ANSI colors are gated on TTY plus the NO_COLOR/FORCE_COLOR conventions.
 */

const tintCodes = {
    accent: '36',
    bold: '1',
    dim: '2',
    green: '32',
    red: '31',
    yellow: '33',
} as const;

export type CliTint = keyof typeof tintCodes;

export interface CliRenderer {
    banner(identity: { version: string }): string;
    fail(message: string): string;
    header(identity: { version: string }): string;
    heading(text: string): string;
    hint(text: string): string;
    ok(message: string): string;
    tint(tint: CliTint, text: string): string;
    updateStatusLine(status: ComputerUpdateStatus): string;
    warn(message: string): string;
}

export function cliColorsEnabled(env: Record<string, string | undefined>, isTTY: boolean): boolean {
    if (env.NO_COLOR) {
        return false;
    }
    if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') {
        return true;
    }
    return isTTY;
}

export function createCliRenderer(options: { colors: boolean }): CliRenderer {
    const tint = (name: CliTint, text: string) =>
        options.colors ? `\u001B[${tintCodes[name]}m${text}\u001B[0m` : text;
    return {
        banner: (identity) =>
            [
                `  ${tint('accent', '╭─◠◠◠─╮')}`,
                ` ${tint('accent', '╱')} ${tint('accent', '◆')}     ${tint('accent', '╲')}   ${tint('bold', 'Grotto Computer')} ${tint('dim', `v${identity.version}`)}`,
            ].join('\n'),
        fail: (message) => `${tint('red', '✗')} ${message}`,
        header: (identity) =>
            `${tint('accent', '◆')} ${tint('bold', 'Grotto Computer')} ${tint('dim', `v${identity.version}`)}`,
        heading: (text) => tint('bold', text),
        hint: (text) => tint('dim', text),
        ok: (message) => `${tint('green', '✓')} ${message}`,
        tint,
        updateStatusLine: (status) => updateStatusLine(tint, status),
        warn: (message) => `${tint('yellow', '●')} ${message}`,
    };
}

/** Renderer for the current process; colors follow stdout. */
export const stdoutRenderer: CliRenderer = createCliRenderer({
    colors: cliColorsEnabled(process.env, process.stdout.isTTY === true),
});

/** Glyphs without ANSI codes, for callers formatting outside a known stream. */
export const plainCliRenderer: CliRenderer = createCliRenderer({ colors: false });

function updateStatusLine(
    tint: (name: CliTint, text: string) => string,
    status: ComputerUpdateStatus
): string {
    switch (status.kind) {
        case 'development':
            return tint('dim', '· Development build — update checks are skipped');
        case 'unknown':
            return tint('dim', '· Update check unavailable');
        case 'up-to-date':
            return `${tint('green', '✓')} ${tint('dim', 'Up to date')}`;
        case 'update-available':
            return `${tint('yellow', '●')} Update available: v${status.latestVersion} — run ${tint('bold', 'grotto-computer upgrade')}`;
        default:
            return statusNever(status);
    }
}

function statusNever(status: never): never {
    throw new Error(`Unknown update status: ${JSON.stringify(status)}`);
}
