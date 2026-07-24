import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { type BrowserLaunchContract, isProfileCompatible } from './launch-contract.ts';
import type { ManagedChromeMatch, ProcessListReader, ProcessRecord } from './types.ts';

const execFileAsync = promisify(execFile);

// Root discovery matches only Tavern's exact executable and user-data
// directory. Personal Chrome processes are never candidates.
export function locateManagedChrome(
    processes: ProcessRecord[],
    contract: BrowserLaunchContract
): ManagedChromeMatch | null {
    const root = processes.find((record) => isManagedRoot(record, contract));
    if (!root) {
        return null;
    }

    const gpu = processes
        .filter(
            (record) =>
                record.parentPid === root.pid && record.command.includes('--type=gpu-process')
        )
        .reduce<ProcessRecord | null>(
            (best, record) => (best && best.cpuPercent >= record.cpuPercent ? best : record),
            null
        );
    return { gpu, root };
}

function isManagedRoot(record: ProcessRecord, contract: BrowserLaunchContract): boolean {
    if (record.command.includes('--type=')) {
        return false;
    }
    return (
        record.command.includes(contract.executablePath) &&
        (record.command.includes(`--user-data-dir=${contract.userDataDir}`) ||
            record.command.includes(`--user-data-dir ${contract.userDataDir}`))
    );
}

export function isCompatibleManagedRoot(
    match: ManagedChromeMatch,
    contract: BrowserLaunchContract
): boolean {
    return isProfileCompatible(match.root.command, contract);
}

export class SystemProcessList implements ProcessListReader {
    async read(): Promise<ProcessRecord[]> {
        const { stdout } = await execFileAsync(
            '/bin/ps',
            ['-axo', 'pid=,ppid=,etime=,%cpu=,rss=,command='],
            { maxBuffer: 16 * 1024 * 1024, timeout: 10_000 }
        );
        return parseProcessList(stdout);
    }
}

export function parseProcessList(output: string): ProcessRecord[] {
    return output
        .split('\n')
        .map(parseProcessLine)
        .filter((record): record is ProcessRecord => record !== null);
}

function parseProcessLine(line: string): ProcessRecord | null {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(.+)$/);
    if (!match) {
        return null;
    }
    const [, pid, parentPid, etime, cpuPercent, rssKilobytes, command] = match;
    if (!(pid && parentPid && etime && cpuPercent && rssKilobytes && command)) {
        return null;
    }
    const elapsedSeconds = parseElapsedSeconds(etime);
    if (elapsedSeconds === null) {
        return null;
    }
    return {
        command,
        cpuPercent: Number(cpuPercent),
        elapsedSeconds,
        parentPid: Number(parentPid),
        pid: Number(pid),
        rssBytes: Number(rssKilobytes) * 1024,
    };
}

// ps etime formats: MM:SS, HH:MM:SS, or D-HH:MM:SS.
function parseElapsedSeconds(value: string): number | null {
    const [dayPart, clockPart] = value.includes('-')
        ? (value.split('-', 2) as [string, string])
        : ['0', value];
    const days = Number(dayPart);
    const segments = clockPart.split(':').map(Number);
    if (Number.isNaN(days) || segments.some(Number.isNaN)) {
        return null;
    }
    if (segments.length === 2) {
        const [minutes = 0, seconds = 0] = segments;
        return days * 86_400 + minutes * 60 + seconds;
    }
    if (segments.length === 3) {
        const [hours = 0, minutes = 0, seconds = 0] = segments;
        return days * 86_400 + hours * 3600 + minutes * 60 + seconds;
    }
    return null;
}
