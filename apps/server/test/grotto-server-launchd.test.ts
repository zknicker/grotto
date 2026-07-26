import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = fileURLToPath(new URL('../', import.meta.url));
const launchdRoot = join(serverRoot, 'launchd');
const services = ['postgresql', 'server', 'tunnel', 'backup', 'monitor'] as const;

test('ships valid supervised services without checked-in secret values', () => {
    const plists = services.map((service) => {
        const path = join(launchdRoot, `com.grotto.${service}.plist`);
        const lint = Bun.spawnSync(['/usr/bin/plutil', '-lint', path], {
            stderr: 'pipe',
            stdout: 'pipe',
        });
        expect(lint.exitCode).toBe(0);
        const converted = Bun.spawnSync(['/usr/bin/plutil', '-convert', 'json', '-o', '-', path], {
            stderr: 'pipe',
            stdout: 'pipe',
        });
        expect(converted.exitCode).toBe(0);
        return JSON.parse(converted.stdout.toString()) as {
            KeepAlive?: boolean;
            ProgramArguments: string[];
            RunAtLoad?: boolean;
            StartCalendarInterval?: { Hour: number; Minute: number }[];
            StartInterval?: number;
            UserName: string;
        };
    });

    expect(plists.map((plist) => plist.UserName)).toEqual([
        '_postgres',
        '_grotto_server',
        '_grotto_tunnel',
        '_grotto_backup',
        '_grotto_monitor',
    ]);
    expect(plists[2]?.ProgramArguments).toContain('grotto-production');
    expect(plists[3]?.StartCalendarInterval).toEqual([
        { Hour: 0, Minute: 15 },
        { Hour: 6, Minute: 15 },
        { Hour: 12, Minute: 15 },
        { Hour: 18, Minute: 15 },
    ]);
    expect(plists[4]?.StartInterval).toBe(60);
    expect(plists.filter((plist) => plist.RunAtLoad)).toHaveLength(3);
    expect(plists.filter((plist) => plist.KeepAlive)).toHaveLength(3);
    expect(JSON.stringify(plists)).not.toContain('postgres://');
    expect(JSON.stringify(plists)).not.toContain('hc-ping.com');
});
