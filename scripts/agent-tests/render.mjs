// Streaming console output for concurrent scenario lanes. On a TTY the active
// lanes repaint in place ("▶ 01 name  turn active · 24s"); otherwise each phase
// change is a plain appended line so CI logs stay readable.

const nameColumn = 26;
const repaintMs = 1000;
const esc = String.fromCharCode(27);
const cursorUp = `${esc}[`;
const clearBelow = `${esc}[0J`;

export function createRenderer({ quiet = false, stream = process.stdout } = {}) {
    const active = new Map();
    const tty = Boolean(stream.isTTY) && !quiet;
    let painted = 0;
    let timer = null;

    function write(text) {
        if (!quiet) {
            stream.write(text);
        }
    }

    function clearActive() {
        if (!tty || painted === 0) {
            return;
        }
        stream.write(`${cursorUp}${painted}A${clearBelow}`);
        painted = 0;
    }

    function paintActive() {
        if (!tty) {
            return;
        }
        const lines = [...active.values()].map(activeLine);
        stream.write(lines.map((line) => `${line}\n`).join(''));
        painted = lines.length;
    }

    function repaint() {
        clearActive();
        paintActive();
    }

    function ensureTimer() {
        if (tty && !timer && active.size > 0) {
            timer = setInterval(repaint, repaintMs);
            timer.unref?.();
        }
        if (timer && active.size === 0) {
            clearInterval(timer);
            timer = null;
        }
    }

    return {
        finish(key, { error, ok, seconds }) {
            const entry = active.get(key);
            active.delete(key);
            clearActive();
            if (entry) {
                write(`${activeLine({ ...entry, phase: ok ? 'settled' : 'failed' })}\n`);
            }
            write(
                ok ? `  ✓ pass (${seconds}s)\n` : `  ✗ fail (${seconds}s) — ${firstLine(error)}\n`
            );
            paintActive();
            ensureTimer();
        },
        phase(key, phase) {
            const entry = active.get(key);
            if (!entry) {
                return;
            }
            entry.phase = phase;
            if (tty) {
                repaint();
            } else {
                write(`  · ${entry.name} — ${phase} (${elapsed(entry)}s)\n`);
            }
        },
        start(key, { index, name }) {
            const entry = { index, name, phase: 'starting', startedAt: Date.now() };
            clearActive();
            active.set(key, entry);
            if (!tty) {
                write(`${activeLine(entry)}\n`);
            }
            paintActive();
            ensureTimer();
        },
        stop() {
            clearActive();
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        },
        summary(rows, footer) {
            write('\n');
            for (const row of rows) {
                write(
                    `  ${pad(row.name, nameColumn)}${pad(row.ok ? 'pass' : 'fail', 8)}${String(row.seconds).padStart(4)}s\n`
                );
            }
            write(`\n${footer}\n`);
        },
    };
}

export function activeLine(entry) {
    const label = `▶ ${String(entry.index).padStart(2, '0')} ${pad(entry.name, nameColumn)}`;
    return `${label}${entry.phase} · ${elapsed(entry)}s`;
}

export function pad(value, width) {
    return String(value).padEnd(width, ' ');
}

export function formatWall(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}m ${totalSeconds - minutes * 60}s`;
}

function elapsed(entry) {
    return Math.round((Date.now() - entry.startedAt) / 1000);
}

function firstLine(error) {
    return String(error ?? 'unknown failure').split('\n')[0];
}
