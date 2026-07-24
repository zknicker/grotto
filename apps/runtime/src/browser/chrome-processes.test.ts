import { describe, expect, test } from 'vitest';
import { locateManagedChrome, parseProcessList } from './chrome-processes.ts';
import { buildLaunchArguments } from './launch-contract.ts';

const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = '/Users/op/.tavern/browser/profiles/agent';
const contract = { executablePath, userDataDir };
const managedCommand = `${executablePath} ${buildLaunchArguments(contract).join(' ')}`;

describe('parseProcessList', () => {
    test('parses pid, ppid, etime, cpu, rss, and command columns', () => {
        const [record] = parseProcessList(
            `  423   1 01:02:03 12.5 204800 ${managedCommand}\n` // one line
        );
        expect(record).toMatchObject({
            cpuPercent: 12.5,
            elapsedSeconds: 3723,
            parentPid: 1,
            pid: 423,
            rssBytes: 204_800 * 1024,
        });
        expect(record?.command).toBe(managedCommand);
    });

    test('parses day-form etime and skips malformed lines', () => {
        const records = parseProcessList(
            [
                `  9   1 2-01:00:00 0.0 1024 ${managedCommand}`,
                '  10  1 05:30 1.0 2048 /bin/sleep 300',
                'garbage line',
                '',
            ].join('\n')
        );
        expect(records).toHaveLength(2);
        expect(records[0]?.elapsedSeconds).toBe(2 * 86_400 + 3600);
        expect(records[1]?.elapsedSeconds).toBe(330);
    });
});

describe('locateManagedChrome', () => {
    test('finds the managed root and its GPU helper', () => {
        const match = locateManagedChrome(
            parseProcessList(
                [
                    `  400   1 10:00 3.0 100000 ${managedCommand}`,
                    `  401 400 09:00 55.0 50000 ${executablePath} --type=gpu-process`,
                    `  402 400 09:00 80.0 60000 ${executablePath} --type=gpu-process`,
                    `  403 400 09:00 1.0 10000 ${executablePath} --type=renderer`,
                ].join('\n')
            ),
            contract
        );
        expect(match?.root.pid).toBe(400);
        expect(match?.gpu?.pid).toBe(402);
    });

    test('never matches personal Chrome or helper processes as the root', () => {
        const match = locateManagedChrome(
            parseProcessList(
                [
                    `  500   1 10:00 3.0 100000 ${executablePath}`,
                    `  501   1 10:00 3.0 100000 ${executablePath} --user-data-dir=/Users/op/Library/Application Support/Google/Chrome`,
                    `  502 500 10:00 3.0 100000 ${managedCommand} --type=utility`,
                ].join('\n')
            ),
            contract
        );
        expect(match).toBeNull();
    });
});
