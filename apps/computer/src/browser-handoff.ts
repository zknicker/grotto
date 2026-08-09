import { spawn as nodeSpawn } from 'node:child_process';

interface BrowserProcess {
    on(event: 'error', listener: () => void): BrowserProcess;
    unref(): void;
}

export type SpawnBrowserProcess = (
    command: string,
    args: string[],
    options: { detached: true; stdio: 'ignore'; windowsHide: true }
) => BrowserProcess;

interface BrowserHandoffInput {
    isTTY?: boolean;
    off(event: 'data', listener: (chunk: unknown) => void): unknown;
    on(event: 'data', listener: (chunk: unknown) => void): unknown;
    pause?(): unknown;
    resume?(): unknown;
}

export function openUrlInBrowser(
    url: string,
    options: {
        platform?: NodeJS.Platform;
        spawn?: SpawnBrowserProcess;
    } = {}
): void {
    const platform = options.platform ?? process.platform;
    const spawn = options.spawn ?? (nodeSpawn as SpawnBrowserProcess);
    const [command, args] = browserCommand(platform, url);
    const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });
    child.on('error', () => {});
    child.unref();
}

export function installEnterToOpenUrl(options: {
    input: BrowserHandoffInput;
    openUrl?: (url: string) => void;
    url: string;
}): () => void {
    if (!options.input.isTTY) {
        return () => {};
    }
    const openUrl = options.openUrl ?? openUrlInBrowser;
    let active = true;
    const cleanup = () => {
        if (!active) {
            return;
        }
        active = false;
        options.input.off('data', onData);
        options.input.pause?.();
    };
    const onData = (chunk: unknown) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        if (!(text.includes('\n') || text.includes('\r'))) {
            return;
        }
        cleanup();
        openUrl(options.url);
    };
    options.input.on('data', onData);
    options.input.resume?.();
    return cleanup;
}

function browserCommand(platform: NodeJS.Platform, url: string): [string, string[]] {
    if (platform === 'darwin') {
        return ['open', [url]];
    }
    if (platform === 'win32') {
        return ['cmd', ['/c', 'start', '', url]];
    }
    return ['xdg-open', [url]];
}
