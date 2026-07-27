import { runGrottoMonitor } from './grotto-monitor.ts';

try {
    const codes = await runGrottoMonitor({
        pgIsReadyCommand: required('GROTTO_PG_ISREADY_COMMAND'),
        postgresDatabase: required('GROTTO_HEALTH_POSTGRES_DATABASE'),
        postgresHost: required('GROTTO_HEALTH_POSTGRES_HOST'),
        postgresPort: required('GROTTO_HEALTH_POSTGRES_PORT'),
        probes: {
            postgresPingUrl: process.env.GROTTO_HEALTH_POSTGRES_PING_URL,
            publicPingUrl: process.env.GROTTO_HEALTH_PUBLIC_PING_URL,
            publicUrl: required('GROTTO_HEALTH_PUBLIC_URL'),
            serverPingUrl: process.env.GROTTO_HEALTH_SERVER_PING_URL,
            serverUrl: required('GROTTO_HEALTH_SERVER_URL'),
            tunnelPingUrl: process.env.GROTTO_HEALTH_TUNNEL_PING_URL,
            tunnelUrl: required('GROTTO_HEALTH_TUNNEL_URL'),
        },
    });
    console.log(
        JSON.stringify(codes.length === 0 ? { status: 'ok' } : { codes, status: 'unhealthy' })
    );
    process.exit(codes.length === 0 ? 0 : 1);
} catch {
    console.error(JSON.stringify({ code: 'monitor_config_invalid', status: 'error' }));
    process.exit(1);
}

function required(name: string) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required.`);
    }
    return value;
}
