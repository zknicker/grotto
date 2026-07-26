import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = fileURLToPath(new URL('../', import.meta.url));
const colimaRoot = join(serverRoot, 'colima');
const operationsRoot = join(serverRoot, 'operations');

test('ships system-boot supervision for the existing Colima profile', () => {
    const plistPath = join(colimaRoot, 'com.merchbaseco.colima-autostart.plist');
    const lint = Bun.spawnSync(['/usr/bin/plutil', '-lint', plistPath], {
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const converted = Bun.spawnSync(['/usr/bin/plutil', '-convert', 'json', '-o', '-', plistPath], {
        stderr: 'pipe',
        stdout: 'pipe',
    });
    expect(lint.exitCode).toBe(0);
    expect(converted.exitCode).toBe(0);

    const plist = JSON.parse(converted.stdout.toString()) as {
        EnvironmentVariables: Record<string, string>;
        GroupName: string;
        KeepAlive?: unknown;
        ProcessType?: string;
        ProgramArguments: string[];
        RunAtLoad: boolean;
        StartInterval: number;
        UserName: string;
    };
    expect(plist.UserName).toBe('zknicker');
    expect(plist.GroupName).toBe('staff');
    expect(plist.RunAtLoad).toBeTrue();
    expect(plist.StartInterval).toBe(60);
    expect(plist.KeepAlive).toBeUndefined();
    expect(plist.ProcessType).toBeUndefined();
    expect(plist.ProgramArguments).toEqual(['/Users/zknicker/services/bin/ensure-colima.sh']);
    expect(plist.EnvironmentVariables.HOME).toBe('/Users/zknicker');
});

test('ships syntax-valid install and rollback operations for only Colima supervision', () => {
    const installPath = join(operationsRoot, 'install-colima-boot');
    const rollbackPath = join(operationsRoot, 'rollback-colima-boot');

    for (const path of [installPath, rollbackPath]) {
        const syntax = Bun.spawnSync(['/bin/sh', '-n', path], {
            stderr: 'pipe',
            stdout: 'pipe',
        });
        expect(syntax.exitCode).toBe(0);
    }

    const install = readFileSync(installPath, 'utf8');
    const rollback = readFileSync(rollbackPath, 'utf8');
    expect(install).toContain('bootout gui/');
    expect(install).toContain('disable gui/');
    expect(install).toContain('bootstrap system');
    expect(install).toContain('--inventory');
    expect(install).toContain('--dry-run');
    expect(install).toContain('/usr/bin/cmp -s "$source_plist" "$daemon"');
    expect(install).toContain('System Colima LaunchDaemon is already installed');
    expect(rollback).toContain('bootout system');
    expect(rollback).toContain('enable gui/');
    expect(rollback).toContain('bootstrap gui/');
    expect(`${install}${rollback}`).not.toContain('docker restart');
    expect(`${install}${rollback}`).not.toContain('colima stop');
});
