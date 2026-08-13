import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const postgresUser = 'grotto';
const postgresDatabase = 'grotto';

export function stopStaleDevPostgres(environment, options = {}) {
    const fileSystem = options.fileSystem ?? fs;
    const spawnCommand = options.spawnCommand ?? spawnSync;
    const dataRoot = environment.GROTTO_POSTGRES_DATA_ROOT;
    const postmasterPath = path.join(dataRoot, 'postmaster.pid');

    if (!fileSystem.existsSync(postmasterPath)) {
        return 0;
    }

    const binaries = options.binaries ?? resolvePostgresBinaries();
    const status = spawnCommand(binaries.pgCtl, ['--pgdata', dataRoot, 'status'], {
        encoding: 'utf8',
    });
    if (status.status !== 0) {
        return 0;
    }

    const result = spawnCommand(
        binaries.pgCtl,
        ['--pgdata', dataRoot, '--mode', 'fast', '--wait', 'stop'],
        { encoding: 'utf8' }
    );
    if (result.status !== 0) {
        throw new Error(
            result.stderr?.trim() ||
                result.stdout?.trim() ||
                'Failed to stop stale development PostgreSQL.'
        );
    }

    return 1;
}

export function prepareDevPostgres(environment, port) {
    const binaries = resolvePostgresBinaries();
    const dataRoot = environment.GROTTO_POSTGRES_DATA_ROOT;
    const socketRoot = environment.GROTTO_POSTGRES_SOCKET_ROOT;

    fs.mkdirSync(path.dirname(dataRoot), { recursive: true });
    fs.mkdirSync(socketRoot, { recursive: true });
    if (!fs.existsSync(path.join(dataRoot, 'PG_VERSION'))) {
        run(binaries.initdb, [
            '--auth=trust',
            '--encoding=UTF8',
            '--no-sync',
            '--username',
            postgresUser,
            '--pgdata',
            dataRoot,
        ]);
    }

    return {
        args: [
            '-D',
            dataRoot,
            '-h',
            '127.0.0.1',
            '-k',
            socketRoot,
            '-p',
            String(port),
            '-c',
            'fsync=off',
            '-c',
            'full_page_writes=off',
        ],
        binaries,
        databaseUrl: `postgres://${postgresUser}@127.0.0.1:${port}/${postgresDatabase}`,
        executable: binaries.postgres,
        port,
        socketRoot,
    };
}

export async function reserveDevPostgresPort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : null;
    await new Promise((resolve) => server.close(resolve));
    if (!port) {
        throw new Error('Failed to reserve a development PostgreSQL port.');
    }
    return port;
}

export async function waitForDevPostgres(postgres, child) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`Development PostgreSQL exited with code ${child.exitCode}.`);
        }
        const ready = spawnSync(
            postgres.binaries.pgIsReady,
            ['--host', '127.0.0.1', '--port', String(postgres.port), '--username', postgresUser],
            { stdio: 'ignore' }
        );
        if (ready.status === 0) {
            ensureDatabase(postgres);
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Development PostgreSQL did not become ready.');
}

export function hasGrottoSchema(postgres) {
    const result = spawnSync(
        postgres.binaries.psql,
        [
            '--host',
            '127.0.0.1',
            '--port',
            String(postgres.port),
            '--username',
            postgresUser,
            '--dbname',
            postgresDatabase,
            '--tuples-only',
            '--no-align',
            '--command',
            "select to_regclass('public.servers') is not null",
        ],
        { encoding: 'utf8' }
    );
    if (result.status !== 0) {
        throw new Error(result.stderr.trim() || 'Failed to inspect development PostgreSQL.');
    }
    return result.stdout.trim() === 't';
}

function ensureDatabase(postgres) {
    const exists = spawnSync(
        postgres.binaries.psql,
        [
            '--host',
            '127.0.0.1',
            '--port',
            String(postgres.port),
            '--username',
            postgresUser,
            '--dbname',
            'postgres',
            '--tuples-only',
            '--no-align',
            '--command',
            `select 1 from pg_database where datname = '${postgresDatabase}'`,
        ],
        { encoding: 'utf8' }
    );
    if (exists.status !== 0) {
        throw new Error(exists.stderr.trim() || 'Failed to inspect development PostgreSQL.');
    }
    if (exists.stdout.trim() === '1') {
        return;
    }
    run(postgres.binaries.createdb, [
        '--host',
        '127.0.0.1',
        '--port',
        String(postgres.port),
        '--username',
        postgresUser,
        postgresDatabase,
    ]);
}

function resolvePostgresBinaries() {
    const explicitRoot = process.env.GROTTO_POSTGRES_BIN;
    const searchRoots = explicitRoot
        ? [explicitRoot]
        : ['/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin', ''];

    for (const searchRoot of searchRoots) {
        const candidate = {
            createdb: path.join(searchRoot, 'createdb'),
            initdb: path.join(searchRoot, 'initdb'),
            pgCtl: path.join(searchRoot, 'pg_ctl'),
            pgIsReady: path.join(searchRoot, 'pg_isready'),
            postgres: path.join(searchRoot, 'postgres'),
            psql: path.join(searchRoot, 'psql'),
        };
        if (spawnSync(candidate.initdb, ['--version'], { stdio: 'ignore' }).status === 0) {
            return candidate;
        }
    }

    throw new Error(
        'PostgreSQL 16 is required for the development Server. Install it with `brew install postgresql@16`.'
    );
}

function run(command, args) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(result.stderr.trim() || `${command} exited ${result.status}.`);
    }
}
