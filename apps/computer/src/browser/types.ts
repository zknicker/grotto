export interface ProcessRecord {
    command: string;
    cpuPercent: number;
    elapsedSeconds: number;
    parentPid: number;
    pid: number;
    rssBytes: number;
}

export interface ManagedChromeMatch {
    gpu: ProcessRecord | null;
    root: ProcessRecord;
}

export type CdpProbeState = 'healthy' | 'unknown' | 'unreachable';

export interface CdpSnapshot {
    latencyMs: number | null;
    state: CdpProbeState;
}

export interface CdpAttachment {
    port: number;
    webSocketDebuggerUrl: string;
}

export interface ChromeApplication {
    executablePath: string;
    path: string;
    version: string | null;
}

export interface BrowserResourceSample {
    browserCpuPercent: number | null;
    browserRssBytes: number | null;
    gpuCpuPercent: number | null;
    gpuRssBytes: number | null;
}

export interface BrowserObservation {
    cdp: CdpSnapshot;
    contractCompatible: boolean;
    lockHeld: boolean;
    pid: number | null;
    resources: BrowserResourceSample;
    running: boolean;
    uptimeSeconds: number | null;
}

export const stoppedBrowserObservation: BrowserObservation = {
    cdp: { latencyMs: null, state: 'unknown' },
    contractCompatible: true,
    lockHeld: false,
    pid: null,
    resources: {
        browserCpuPercent: null,
        browserRssBytes: null,
        gpuCpuPercent: null,
        gpuRssBytes: null,
    },
    running: false,
    uptimeSeconds: null,
};

export interface BrowserLifecycleControl {
    attachment(): Promise<CdpAttachment>;
    observe(): Promise<BrowserObservation>;
    restart(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
}

export interface ProcessListReader {
    read(): Promise<ProcessRecord[]>;
}

export interface CdpProber {
    attachment(userDataDir: string): Promise<CdpAttachment>;
    probe(userDataDir: string): Promise<CdpSnapshot>;
}

export interface ChromeProcessControl {
    isAlive(pid: number): boolean;
    signal(pid: number, signal: 'SIGKILL' | 'SIGTERM'): void;
    spawnDetached(executablePath: string, args: string[]): number;
}

export interface BrowserClock {
    now(): number;
}

export const systemBrowserClock: BrowserClock = {
    now: () => Date.now(),
};
