import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const serverRoot = fileURLToPath(new URL('../', import.meta.url));
const launchdRoot = join(serverRoot, 'launchd');
const services = ['server', 'tunnel', 'backup', 'monitor'] as const;

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
        '_grotto_server',
        '_grotto_tunnel',
        '_grotto_backup',
        '_grotto_monitor',
    ]);
    expect(plists[1]?.ProgramArguments).toContain('grotto-production');
    expect(plists[1]?.ProgramArguments).toContain('127.0.0.1:20242');
    expect(plists[2]?.StartCalendarInterval).toEqual([
        { Hour: 0, Minute: 15 },
        { Hour: 6, Minute: 15 },
        { Hour: 12, Minute: 15 },
        { Hour: 18, Minute: 15 },
    ]);
    expect(plists[3]?.StartInterval).toBe(60);
    expect(plists.filter((plist) => plist.RunAtLoad)).toHaveLength(2);
    expect(plists.filter((plist) => plist.KeepAlive)).toHaveLength(2);
    expect(JSON.stringify(plists)).not.toContain('postgres://');
    expect(JSON.stringify(plists)).not.toContain('hc-ping.com');
});

test('ships one private PostgreSQL Compose service with durable state', () => {
    const composeText = readFileSync(join(serverRoot, 'compose.yml'), 'utf8');
    const compose = parse(composeText) as {
        name: string;
        services: Record<string, Record<string, unknown>>;
        volumes: Record<string, { name: string }>;
    };
    const postgres = compose.services.postgres;

    expect(compose.name).toBe('grotto');
    expect(Object.keys(compose.services)).toEqual(['postgres']);
    expect(postgres?.container_name).toBe('grotto-postgres');
    expect(postgres?.image).toBe(
        'postgres:16.14-alpine@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777'
    );
    expect(postgres?.ports).toEqual(['127.0.0.1:5438:5432']);
    expect(postgres?.restart).toBe('unless-stopped');
    expect(postgres?.stop_signal).toBe('SIGINT');
    expect(postgres?.volumes).toEqual(['postgres_data:/var/lib/postgresql/data']);
    expect(compose.volumes.postgres_data?.name).toBe('grotto_postgres_data');
    expect(composeText).toContain(
        'POSTGRES_PASSWORD: ${GROTTO_POSTGRES_ADMIN_PASSWORD:?GROTTO_POSTGRES_ADMIN_PASSWORD is required}'
    );
    expect(composeText).not.toContain('POSTGRES_HOST_AUTH_METHOD');
    expect(composeText).not.toContain('GENERATE_ON_HOST');
});

test('ships collision-free production PostgreSQL and Tunnel endpoints', () => {
    const productionExamples = ['server.env.example', 'backup.env.example', 'restore.env.example'];
    for (const example of productionExamples) {
        const text = readFileSync(join(serverRoot, 'config', example), 'utf8');
        expect(text).toContain('127.0.0.1:5438');
        expect(text).not.toContain('127.0.0.1:5432');
    }

    const monitor = readFileSync(join(serverRoot, 'config', 'monitor.env.example'), 'utf8');
    expect(monitor).toContain('GROTTO_HEALTH_POSTGRES_HOST=127.0.0.1');
    expect(monitor).toContain('GROTTO_HEALTH_POSTGRES_PORT=5438');
    expect(monitor).toContain('http://127.0.0.1:20242/ready');
    expect(monitor).not.toContain('127.0.0.1:20241');
});
