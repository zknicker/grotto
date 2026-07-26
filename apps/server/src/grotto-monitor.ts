import { stat } from 'node:fs/promises';

export interface GrottoMonitorOptions {
    backupSuccessFile: string;
    pgIsReadyCommand: string;
    postgresDatabase: string;
    postgresHost: string;
    postgresPort: string;
    probes: {
        backupPingUrl?: string;
        postgresPingUrl?: string;
        publicPingUrl?: string;
        publicUrl: string;
        serverPingUrl?: string;
        serverUrl: string;
        tunnelPingUrl?: string;
        tunnelUrl: string;
    };
}

interface HealthProbe {
    alertUrl: string | undefined;
    code: string;
    run(): Promise<boolean>;
}

export async function runGrottoMonitor(options: GrottoMonitorOptions) {
    const probes: HealthProbe[] = [
        {
            alertUrl: options.probes.serverPingUrl,
            code: 'server_unreachable',
            run: () => checkGrottoRoute(options.probes.serverUrl),
        },
        {
            alertUrl: options.probes.postgresPingUrl,
            code: 'postgres_unavailable',
            run: () =>
                checkPostgres(
                    options.pgIsReadyCommand,
                    options.postgresHost,
                    options.postgresPort,
                    options.postgresDatabase
                ),
        },
        {
            alertUrl: options.probes.tunnelPingUrl,
            code: 'tunnel_unavailable',
            run: () => checkHttp(options.probes.tunnelUrl),
        },
        {
            alertUrl: options.probes.publicPingUrl,
            code: 'public_route_unavailable',
            run: () => checkGrottoRoute(options.probes.publicUrl),
        },
        {
            alertUrl: options.probes.backupPingUrl,
            code: 'backup_stale',
            run: () => checkBackupFreshness(options.backupSuccessFile),
        },
    ];
    const results = await Promise.all(
        probes.map(async (probe) => ({ ...probe, healthy: await probe.run() }))
    );
    await Promise.all(results.map((result) => pingHealthcheck(result.alertUrl, result.healthy)));
    return results.filter((result) => !result.healthy).map((result) => result.code);
}

async function checkHttp(url: string) {
    try {
        return (
            await fetch(url, {
                signal: AbortSignal.timeout(8000),
            })
        ).ok;
    } catch {
        return false;
    }
}

async function checkGrottoRoute(url: string) {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (response.ok) {
            return true;
        }
        const body = (await response.json()) as { code?: unknown; status?: unknown };
        return body.code === 'postgres_unavailable' && body.status === 'unhealthy';
    } catch {
        return false;
    }
}

async function checkPostgres(command: string, host: string, port: string, database: string) {
    try {
        const child = Bun.spawn([command, '--host', host, '--port', port, '--dbname', database], {
            killSignal: 'SIGKILL',
            stderr: 'ignore',
            stdout: 'ignore',
            timeout: 8000,
        });
        return (await child.exited) === 0;
    } catch {
        return false;
    }
}

async function checkBackupFreshness(path: string) {
    try {
        const file = await stat(path);
        return Date.now() - file.mtimeMs <= 8 * 60 * 60 * 1000;
    } catch {
        return false;
    }
}

async function pingHealthcheck(url: string | undefined, healthy: boolean) {
    if (!url) {
        return;
    }
    const target = healthy ? url : `${url.replace(/\/$/u, '')}/fail`;
    await fetch(target, {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
    }).catch(() => undefined);
}
