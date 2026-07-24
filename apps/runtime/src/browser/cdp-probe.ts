import fs from 'node:fs';
import path from 'node:path';

import type { CdpAttachment, CdpProber, CdpSnapshot } from './types.ts';

const probeTimeoutMs = 1500;

// Chrome writes `DevToolsActivePort` into the user-data directory when
// launched with --remote-debugging-port=0: line one is the OS-selected port,
// line two the browser target's websocket path.
export function readDevToolsActivePort(
    userDataDir: string
): { port: number; webSocketPath: string } | null {
    let contents: string;
    try {
        contents = fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8');
    } catch {
        return null;
    }
    const [portLine, pathLine] = contents.split('\n');
    const port = Number(portLine?.trim());
    if (!Number.isInteger(port) || port <= 0) {
        return null;
    }
    const webSocketPath = pathLine?.trim() ?? '';
    return {
        port,
        webSocketPath: webSocketPath.startsWith('/') ? webSocketPath : `/${webSocketPath}`,
    };
}

export class SystemCdpProber implements CdpProber {
    async probe(userDataDir: string): Promise<CdpSnapshot> {
        const active = readDevToolsActivePort(userDataDir);
        if (!active) {
            return { latencyMs: null, state: 'unreachable' };
        }

        const startedAt = performance.now();
        try {
            const response = await fetch(`http://127.0.0.1:${active.port}/json/version`, {
                signal: AbortSignal.timeout(probeTimeoutMs),
            });
            if (!response.ok) {
                return { latencyMs: null, state: 'unreachable' };
            }
            const payload = (await response.json()) as { Browser?: unknown };
            if (typeof payload.Browser !== 'string') {
                return { latencyMs: null, state: 'unreachable' };
            }
            return { latencyMs: Math.round(performance.now() - startedAt), state: 'healthy' };
        } catch {
            return { latencyMs: null, state: 'unreachable' };
        }
    }

    attachment(userDataDir: string): Promise<CdpAttachment> {
        const active = readDevToolsActivePort(userDataDir);
        if (!active) {
            throw new Error('Browser CDP endpoint is unavailable.');
        }
        return Promise.resolve({
            port: active.port,
            webSocketDebuggerUrl: `ws://127.0.0.1:${active.port}${active.webSocketPath}`,
        });
    }
}
