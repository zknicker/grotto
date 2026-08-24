type StartupTone = 'error' | 'info' | 'success' | 'warning';

const ansi = {
    bold: '\x1b[1m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
    yellow: '\x1b[33m',
} as const;

const startupTones = {
    error: ansi.red,
    info: ansi.cyan,
    success: ansi.green,
    warning: ansi.yellow,
} satisfies Record<StartupTone, string>;

function style(value: string, ...codes: string[]) {
    if (!process.stdout.isTTY) {
        return value;
    }

    return `${codes.join('')}${value}${ansi.reset}`;
}

function isStartupUiEnabled() {
    return process.env.GROTTO_STARTUP_UI === '1';
}

export function logStartupBanner(title: string, subtitle: string) {
    if (isStartupUiEnabled()) {
        return;
    }

    console.log(style(`\n╭─ ${title}`, ansi.bold, ansi.magenta));
    console.log(style(`│  ${subtitle}`, ansi.dim));
}

export function logStartupSection(title: string) {
    if (isStartupUiEnabled()) {
        return;
    }

    console.log(style(`├─ ${title}`, ansi.bold, ansi.cyan));
}

export function logStartupDetail(icon: string, label: string, value: string) {
    if (isStartupUiEnabled()) {
        return;
    }

    const paddedLabel = `${label}:`.padEnd(15, ' ');
    console.log(`${style('│', ansi.dim)}  ${icon} ${style(paddedLabel, ansi.dim)} ${value}`);
}

export function logStartupEvent(icon: string, message: string, tone: StartupTone = 'info') {
    if (isStartupUiEnabled()) {
        return;
    }

    console.log(`${style('│', ansi.dim)}  ${style(icon, startupTones[tone])} ${message}`);
}

export function logStartupComplete(message: string) {
    if (isStartupUiEnabled()) {
        return;
    }

    console.log(style(`╰─ ${message}\n`, ansi.bold, ansi.green));
}

export function logStartupFailure(message: string) {
    console.error(style(`\n╰─ ${message}\n`, ansi.bold, ansi.red));
}

export function formatDurationMs(durationMs: number) {
    if (durationMs % 60_000 === 0) {
        return `${durationMs / 60_000}m`;
    }

    if (durationMs % 1000 === 0) {
        return `${durationMs / 1000}s`;
    }

    return `${durationMs}ms`;
}

export function shortenHomePath(path: string) {
    const homeDirectory = process.env.HOME;
    const compactPath =
        homeDirectory && path.startsWith(homeDirectory)
            ? `~${path.slice(homeDirectory.length)}`
            : path;
    const segments = compactPath.split('/').filter((segment) => segment.length > 0);

    if (segments.length <= 4) {
        return compactPath;
    }

    const prefix = compactPath.startsWith('~/') ? '~' : '';
    const trailingSegments = segments.slice(-2).join('/');

    return `${prefix}/…/${trailingSegments}`;
}
