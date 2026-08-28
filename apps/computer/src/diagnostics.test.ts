import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    doctorComputer,
    formatComputerStatus,
    readComputerLogs,
    readComputerStatus,
} from './diagnostics.ts';

let dataRoot: string;

beforeEach(async () => {
    dataRoot = await mkdtemp(join(tmpdir(), 'grotto-diagnostics-'));
    await mkdir(join(dataRoot, 'servers', 'srv_diagnostics'), { recursive: true });
    await writeFile(
        join(dataRoot, 'servers', 'srv_diagnostics', 'attachment.json'),
        JSON.stringify({
            computerId: 'cmp_diagnostics',
            credential: 'secret',
            serverId: 'srv_diagnostics',
            serverOrigin: 'https://grotto.test',
            slug: 'hq',
        }),
        { mode: 0o600 }
    );
});

afterEach(async () => {
    await rm(dataRoot, { force: true, recursive: true });
});

test('status and doctor expose useful facts without secrets', async () => {
    const status = await readComputerStatus(dataRoot);
    const rendered = formatComputerStatus(status);
    expect(rendered).toContain('/hq');
    expect(rendered).toContain('● stopped — run grotto-computer start /hq');
    expect(rendered).not.toContain('secret');

    const doctor = await doctorComputer(dataRoot, async () => undefined);
    expect(doctor.healthy).toBe(true);
    expect(doctor.checks.map((check) => check.label)).toContain('/hq Server accepts this Computer');
});

test('status gives an actionable setup command for a terminally unlinked attachment', async () => {
    await writeFile(
        join(dataRoot, 'servers', 'srv_diagnostics', 'terminal-unlinked.json'),
        JSON.stringify({
            computerId: 'cmp_diagnostics',
            reason: 'computer_machine_unlinked',
        })
    );

    expect(formatComputerStatus(await readComputerStatus(dataRoot))).toContain(
        '✗ setup required — run grotto-computer setup /hq'
    );
});

test('status warns when an attachment is rapidly disconnecting', async () => {
    const historyRoot = join(dataRoot, 'servers', 'srv_diagnostics', 'connection-history');
    await mkdir(historyRoot, { recursive: true });
    await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
            writeFile(
                join(historyRoot, `${index}.json`),
                JSON.stringify({
                    at: new Date(Date.now() - index * 1000).toISOString(),
                    kind: 'disconnected',
                    reason: 'socket-close',
                })
            )
        )
    );

    expect(formatComputerStatus(await readComputerStatus(dataRoot))).toContain(
        'unstable — 5 disconnects in 5m; run grotto-computer logs 200'
    );
});

test('logs returns a bounded tail from the stable data root', async () => {
    await mkdir(join(dataRoot, 'logs'));
    await writeFile(join(dataRoot, 'logs', 'computer.log'), 'one\ntwo\nthree\n');
    expect(await readComputerLogs(dataRoot, 2)).toBe('two\nthree');
});
