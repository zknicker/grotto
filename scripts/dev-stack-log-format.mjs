const ansi = {
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
    yellow: '\x1b[33m',
};

export const theme = {
    accent: ansi.cyan,
    danger: ansi.red,
    muted: ansi.dim,
    ok: ansi.green,
    warning: ansi.yellow,
};

const processOrder = ['postgres', 'server', 'grotto', 'website', 'desktop'];

const sourceMeta = {
    tavern: { color: theme.accent, icon: '🎰', label: 'grotto' },
    desktop: { color: theme.accent, icon: '🪟', label: 'desktop' },
    grotto: { color: theme.warning, icon: '🏠', label: 'hosted' },
    postgres: { color: theme.warning, icon: '🐘', label: 'postgres' },
    server: { color: theme.warning, icon: '🖥️', label: 'server' },
    website: { color: theme.accent, icon: '🌐', label: 'website' },
};

const statusMeta = {
    disabled: { color: theme.muted, icon: '·', label: 'disabled' },
    error: { color: theme.danger, icon: '✕', label: 'error' },
    running: { color: theme.ok, icon: '✓', label: 'ready' },
    starting: { color: theme.warning, icon: '◐', label: 'starting' },
    stopped: { color: theme.muted, icon: '·', label: 'stopped' },
    stopping: { color: theme.warning, icon: '◐', label: 'stopping' },
    waiting: { color: theme.muted, icon: '·', label: 'waiting' },
};

export function formatHeader(snapshot, { colorize = false } = {}) {
    const lines = [
        formatTavernLine('booting local stack', {
            color: theme.accent,
            colorize,
            icon: '🎰',
        }),
    ];

    if (snapshot.staleCleanupCount > 0) {
        lines.push(
            formatTavernLine(`cleaned ${snapshot.staleCleanupCount} stale dev processes`, {
                color: theme.warning,
                colorize,
                icon: '◐',
            })
        );
    }

    return lines.join('\n');
}

export function formatLogLine(entry, { colorize = false } = {}) {
    const meta = getSourceMeta(entry.source);
    const prefix = formatSourcePrefix(meta, colorize);
    const message = colorizeSeverity(normalizeLine(entry.line), colorize);

    return `${prefix} ${message}`;
}

export function formatStatusLine(source, status, value, { colorize = false } = {}) {
    const meta = getSourceMeta(source);
    const tone = statusMeta[status] ?? statusMeta.waiting;
    const suffix = value ? ` ${dim(value, colorize)}` : '';
    const label = colorizeText(`${tone.icon} ${meta.label} ${tone.label}`, tone.color, colorize);

    return `${label}${suffix}`;
}

export function getSnapshotChangeLines(previous, next, snapshot, { colorize = false } = {}) {
    const lines = [];

    for (const source of processOrder) {
        const previousStatus = previous.processes[source];
        const nextStatus = next.processes[source];
        if (previousStatus !== nextStatus && shouldPrintStatus(nextStatus)) {
            lines.push(
                formatStatusLine(source, nextStatus, getStatusValue(source, nextStatus, snapshot), {
                    colorize,
                })
            );
        }
    }

    if (previous.phase !== next.phase && next.phase === 'running') {
        lines.push(formatReadyBlock(snapshot, { colorize }));
    }

    if (previous.staleCleanupCount !== next.staleCleanupCount && next.staleCleanupCount > 0) {
        lines.push(
            formatTavernLine(`cleaned ${next.staleCleanupCount} stale dev processes`, {
                color: theme.warning,
                colorize,
                icon: '◐',
            })
        );
    }

    if (previous.jobsState !== next.jobsState && next.jobsState === 'loading') {
        lines.push(formatJobsStateLine(next.jobsState, { colorize }));
    }

    return lines;
}

export function formatReadyBlock(snapshot, { colorize = false } = {}) {
    const lines = [
        colorizeText('╭─ 🎰 GROTTO', theme.accent, colorize),
        `${dim('│', colorize)}  ${colorizeText('Ready to go', theme.ok, colorize)}`,
        colorizeText('├─ Services', theme.accent, colorize),
        readyServiceLine('Local API', snapshot.config.serverUrl, colorize),
        readyServiceLine('Server', snapshot.config.grottoServerUrl, colorize),
        readyServiceLine('Website', snapshot.config.websiteUrl, colorize),
        readyServiceLine(
            'Desktop',
            snapshot.config.desktopEnabled ? 'running' : 'disabled',
            colorize
        ),
        colorizeText('├─ Jobs', theme.accent, colorize),
    ];

    if (snapshot.jobs.items.length === 0) {
        lines.push(`${dim('│', colorize)}  ${dim('No scheduled jobs registered', colorize)}`);
    } else {
        const labelWidth = Math.max(...snapshot.jobs.items.map((item) => item.label.length));
        for (const item of snapshot.jobs.items) {
            lines.push(readyJobLine(item, colorize, labelWidth));
        }
    }

    lines.push(colorizeText('├─ Data', theme.accent, colorize));
    lines.push(`${dim('│', colorize)}  ${dim('DB', colorize)}   ${snapshot.config.databasePath}`);
    lines.push(
        `${dim('│', colorize)}  ${dim('PG', colorize)}   ${snapshot.config.postgresDataPath}`
    );
    lines.push(colorizeText('╰─', theme.accent, colorize));

    return lines.join('\n');
}

export function snapshotDigest(snapshot) {
    return {
        jobs: Object.fromEntries(
            snapshot.jobs.items.map((item) => [
                item.key,
                `${item.state}:${item.cadence}:${item.immediate}:${item.label}`,
            ])
        ),
        jobsState: snapshot.jobs.state,
        phase: snapshot.phase,
        processes: Object.fromEntries(
            Object.entries(snapshot.processes).map(([key, processState]) => [
                key,
                processState.status,
            ])
        ),
        staleCleanupCount: snapshot.staleCleanupCount,
    };
}

export function formatTavernLine(message, { color, colorize, icon }) {
    return `${colorizeText(`${icon} grotto`, color, colorize)} ${message}`;
}

function formatJobsStateLine(state, { colorize }) {
    if (state === 'loading') {
        return formatTavernLine('loading scheduled jobs', {
            color: theme.warning,
            colorize,
            icon: '◐',
        });
    }

    if (state === 'ready') {
        return formatTavernLine('scheduled jobs ready', {
            color: theme.ok,
            colorize,
            icon: '✓',
        });
    }

    return formatTavernLine(`scheduled jobs ${state}`, {
        color: theme.muted,
        colorize,
        icon: '·',
    });
}

function readyJobLine(item, colorize, labelWidth) {
    const icon = item.state === 'enabled' ? '✓' : '◐';
    const color = item.state === 'enabled' ? theme.ok : theme.warning;
    const immediate = item.immediate ? ' · immediate' : '';
    const cadence = dim(`every ${item.cadence}${immediate}`, colorize);
    return `${dim('│', colorize)}  ${colorizeText(icon, color, colorize)} ${item.label.padEnd(labelWidth, ' ')} ${cadence}`;
}

function readyServiceLine(label, value, colorize) {
    return `${dim('│', colorize)}  ${colorizeText('✓', theme.ok, colorize)} ${label.padEnd(13, ' ')} ${dim(value, colorize)}`;
}

function shouldPrintStatus(status) {
    return (
        status === 'starting' || status === 'stopping' || status === 'error' || status === 'stopped'
    );
}

function getStatusValue(source, status, snapshot) {
    if (status === 'starting') {
        return '';
    }

    return getProcessValue(source, snapshot);
}

function getProcessValue(source, snapshot) {
    if (source === 'server') {
        return snapshot.config.serverUrl;
    }

    if (source === 'website') {
        return snapshot.config.websiteUrl;
    }

    if (source === 'desktop') {
        return snapshot.config.desktopEnabled ? 'enabled' : 'disabled';
    }
    if (source === 'grotto') {
        return snapshot.config.grottoServerUrl;
    }
    if (source === 'postgres') {
        return snapshot.config.postgresDataPath;
    }

    return '';
}

function formatSourcePrefix(meta, colorize) {
    const label = `${meta.icon} ${meta.label.padEnd(7, ' ')}`;
    return colorizeText(label, meta.color, colorize);
}

function getSourceMeta(source) {
    return (
        sourceMeta[source] ?? {
            color: theme.muted,
            icon: '·',
            label: source,
        }
    );
}

function normalizeLine(line) {
    return String(line).replace(/\s+/gu, ' ').trim();
}

function dim(value, colorize) {
    return colorizeText(value, theme.muted, colorize);
}

function colorizeText(value, code, colorize) {
    if (!colorize) {
        return value;
    }

    return `${code}${value}${ansi.reset}`;
}

function colorizeSeverity(line, colorize) {
    if (!colorize) {
        return line;
    }

    return line
        .replace(/\bFATAL\b/gu, colorizeText('FATAL', theme.danger, true))
        .replace(/\bERROR\b/gu, colorizeText('ERROR', theme.danger, true))
        .replace(/\bWARN\b/gu, colorizeText('WARN', theme.warning, true));
}
