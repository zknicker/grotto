import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const serverRoot = fileURLToPath(new URL('../', import.meta.url));
const hostServicesRoot = join(serverRoot, 'host-services');
const launchdRoot = join(serverRoot, 'launchd');
const services = ['server', 'tunnel', 'backup'] as const;

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
            StandardErrorPath: string;
            StandardOutPath: string;
            StartCalendarInterval?: { Hour: number; Minute: number }[];
            StartInterval?: number;
            UserName: string;
        };
    });

    expect(plists.map((plist) => plist.UserName)).toEqual([
        '_grotto_server',
        '_grotto_tunnel',
        '_grotto_backup',
    ]);
    expect(plists[1]?.ProgramArguments).toContain('grotto-production');
    expect(plists[1]?.ProgramArguments).toContain('127.0.0.1:20242');
    expect(plists[2]?.StartCalendarInterval).toEqual([
        { Hour: 0, Minute: 15 },
        { Hour: 6, Minute: 15 },
        { Hour: 12, Minute: 15 },
        { Hour: 18, Minute: 15 },
    ]);
    expect(plists.filter((plist) => plist.RunAtLoad)).toHaveLength(2);
    expect(plists.filter((plist) => plist.KeepAlive)).toHaveLength(2);
    for (const plist of plists) {
        expect(plist.StandardOutPath).toStartWith('/Users/zknicker/srv/grotto/logs/');
        expect(plist.StandardErrorPath).toStartWith('/Users/zknicker/srv/grotto/logs/');
    }
    expect(plists[0]?.ProgramArguments).toContain(
        '/Users/zknicker/srv/grotto/current/operations/run-server'
    );
    expect(plists[1]?.ProgramArguments).toContain(
        '/Users/zknicker/srv/grotto/config/cloudflared.yml'
    );
    expect(plists[2]?.ProgramArguments).toContain(
        '/Users/zknicker/srv/grotto/current/operations/run-backup'
    );
    expect(JSON.stringify(plists)).not.toContain('postgres://');
    expect(JSON.stringify(plists)).not.toContain('hc-ping.com');
    expect(JSON.stringify(plists)).not.toContain('/opt/grotto-server');
    expect(JSON.stringify(plists)).not.toContain('/Library/Application Support/Grotto');
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
    expect((postgres?.environment as Record<string, string>).POSTGRES_PASSWORD).toBe(
        ['$', '{GROTTO_POSTGRES_ADMIN_PASSWORD:?GROTTO_POSTGRES_ADMIN_PASSWORD is required}'].join(
            ''
        )
    );
    expect(composeText).not.toContain('POSTGRES_HOST_AUTH_METHOD');
    expect(composeText).not.toContain('GENERATE_ON_HOST');
});

test('ships collision-free production PostgreSQL endpoints', () => {
    const productionExamples = ['server.env.example', 'backup.env.example', 'restore.env.example'];
    for (const example of productionExamples) {
        const text = readFileSync(join(serverRoot, 'config', example), 'utf8');
        expect(text).toContain('127.0.0.1:5438');
        expect(text).not.toContain('127.0.0.1:5432');
    }
});

test('keeps production state and credentials inside the canonical srv root', () => {
    const files = [
        ...services.map((service) => join(launchdRoot, `com.grotto.${service}.plist`)),
        ...[
            'backup.env.example',
            'cloudflared.yml.example',
            'restore.env.example',
            'server.env.example',
        ].map((name) => join(serverRoot, 'config', name)),
        ...['run-backup', 'run-restore', 'run-server'].map((name) =>
            join(serverRoot, 'operations', name)
        ),
    ];
    const source = files.map((path) => readFileSync(path, 'utf8')).join('\n');

    expect(source).toContain('/Users/zknicker/srv/grotto/current');
    expect(source).toContain('/Users/zknicker/srv/grotto/config');
    expect(source).toContain('/Users/zknicker/srv/grotto/data');
    expect(source).toContain('/Users/zknicker/srv/grotto/logs');
    expect(source).not.toContain('/opt/grotto-server');
    expect(source).not.toContain('/Library/Application Support/Grotto');
    expect(source).not.toContain('/var/db/grotto-server');
    expect(source).not.toContain('/var/log/grotto-server');
});

test('starts the hosted Server with its provisioned attachment root', () => {
    const runServer = readFileSync(join(serverRoot, 'operations', 'run-server'), 'utf8');

    expect(runServer).toContain(
        'export GROTTO_ATTACHMENT_ROOT=/Users/zknicker/srv/grotto/data/attachments'
    );
});

test('ships one narrow activation privilege rule without automatic installation', () => {
    const sudoers = readFileSync(
        join(hostServicesRoot, 'grotto-server-activation.sudoers'),
        'utf8'
    );

    expect(sudoers).toBe(
        'zknicker ALL=(root) NOPASSWD: /usr/local/libexec/grotto/activate-grotto-server\n'
    );
    expect(sudoers).not.toContain('/bin/sh');
    expect(sudoers).not.toContain('/usr/bin/env');
    expect(sudoers).not.toContain('*');
});
